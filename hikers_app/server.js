require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const path = require('path');
const fs = require('fs');

const app = express();
const HOST = process.env.HOST || 'localhost'; // 'localhost' is most reliable for cPanel internal proxy
const PORT = process.env.PORT || 8082;

// --- CRASH PROTECTION (Global Error Handlers) ---
// Prevents the Node.js process from crashing and going offline on unhandled errors
process.on('uncaughtException', (err) => {
    console.error('🔥 FATAL UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED PROMISE REJECTION:', reason);
});

// --- RAZORPAY SETUP ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- DATABASE SETUP (MySQL) ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  },
  connectTimeout: 5000 // Faster report if port is blocked
});

// --- GLOBAL STATUS ---
let dbStatus = 'INITIALIZING';

// --- DATABASE INITIALIZATION ---
async function initDatabase() {
  global.dbError = "Attempting to connect to " + (process.env.DB_HOST || 'localhost') + ":" + (process.env.DB_PORT || '3306');
  try {
    console.log('📡 Step 1: Requesting connection from pool...');
    global.dbError = "Step 1: Pool request sent (Dialing " + process.env.DB_HOST + ")...";
    
    const connection = await pool.getConnection();
    console.log('🔗 Step 2: Connection acquired, verifying tables...');
    global.dbError = "Step 2: Authenticated, checking tables...";
    
    // Create tables if they don't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        mobile VARCHAR(20) UNIQUE,
        otp VARCHAR(10),
        otp_expiry DATETIME,
        mobile_otp VARCHAR(10),
        mobile_otp_expiry DATETIME,
        verified TINYINT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Attempt to alter existing table safely
    try {
        await connection.query('ALTER TABLE users ADD COLUMN mobile_otp VARCHAR(10)');
        await connection.query('ALTER TABLE users ADD COLUMN mobile_otp_expiry DATETIME');
    } catch (e) { /* Ignore if columns already exist */ }
    
    try {
        await connection.query('ALTER TABLE users ADD UNIQUE (mobile)');
    } catch (e) { /* Ignore if unique constraint exists or fails due to duplicates */ }

    console.log('✅ Users table ready');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userEmail VARCHAR(255) NOT NULL,
        fullName VARCHAR(255),
        mobileNumber VARCHAR(20),
        trekName VARCHAR(255),
        bookingDate DATE,
        participants INT,
        totalCost DECIMAL(10,2),
        amountPaid DECIMAL(10,2) DEFAULT 0,
        paymentStatus VARCHAR(50) DEFAULT 'fully_paid',
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        razorpay_signature VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Safely add columns if the table already exists
    try {
        await connection.query('ALTER TABLE bookings ADD COLUMN amountPaid DECIMAL(10,2) DEFAULT 0');
        await connection.query("ALTER TABLE bookings ADD COLUMN paymentStatus VARCHAR(50) DEFAULT 'fully_paid'");
    } catch (e) { /* Ignore if columns already exist */ }

    console.log('✅ Bookings table ready');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(20),
        subject VARCHAR(255),
        message TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Queries table ready');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Subscribers table ready');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leadSessionId VARCHAR(255) UNIQUE,
        fullName VARCHAR(255),
        mobileNumber VARCHAR(20),
        userEmail VARCHAR(255),
        trekName VARCHAR(255),
        bookingDate DATE,
        participants INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'abandoned',
        emailSent TINYINT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Leads table ready');

    dbStatus = 'UP';
    global.dbError = "UP";
    connection.release();
    console.log('🎉 Database fully initialized!');
  } catch (err) {
    dbStatus = 'DOWN';
    global.dbError = "FAILED: " + err.message;
    console.error('❌ DB Error:', err.message);
  }
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- DIAGNOSTIC HEALTH CHECK ---
app.get(['/health', '/api/health'], (req, res) => {
    res.json({ 
        status: dbStatus === 'UP' ? 'UP' : 'ISSUES',
        database: dbStatus,
        details: global.dbError || 'Initializing...',
        debug: {
            host: process.env.DB_HOST || 'NOT_LOADED',
            port: process.env.DB_PORT || 'NOT_LOADED'
        },
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'production',
        port: PORT 
    });
});

// --- NODEMAILER CONFIG (Updated for cPanel Port 587) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// --- LEADS EMAIL DISPATCH ---
async function sendLeadEmail(lead) {
    try {
        const dateStr = lead.bookingDate ? new Date(lead.bookingDate).toDateString() : 'Not selected';
        const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white; border-radius: 10px; border: 1px solid #1e293b; max-width: 600px; margin: auto;">
            <h2 style="color: #FFD700; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 10px;">⚡ NEW CAPTURED LEAD</h2>
            <p>A customer entered details during trek booking but did not proceed to final payment yet:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8; width: 120px;"><b>Name:</b></td>
                    <td style="padding: 8px 0; color: #ffffff;"><b>${lead.fullName || 'Not entered'}</b></td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;"><b>Phone:</b></td>
                    <td style="padding: 8px 0; color: #ffffff;"><b><a href="tel:${lead.mobileNumber}" style="color: #FFD700; text-decoration: none;">${lead.mobileNumber || 'Not entered'}</a></b></td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;"><b>Email:</b></td>
                    <td style="padding: 8px 0; color: #ffffff;">${lead.userEmail || 'Not entered'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;"><b>Trek Name:</b></td>
                    <td style="padding: 8px 0; color: #FFD700;">${lead.trekName || 'Not entered'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;"><b>Trek Date:</b></td>
                    <td style="padding: 8px 0; color: #ffffff;">${dateStr}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;"><b>People:</b></td>
                    <td style="padding: 8px 0; color: #ffffff;">${lead.participants || 1}</td>
                </tr>
            </table>
            <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;">
            <p style="font-size: 11px; color: #64748b; text-align: center;">This lead has been saved to your Admin Dashboard.</p>
        </div>`;

        const recipients = ['hikershorizon@gmail.com', 'venturesven@gmail.com'].join(',');

        await transporter.sendMail({
            from: `"Hikers Horizon Leads" <${process.env.EMAIL_USER}>`,
            to: recipients,
            subject: `⚠️ Lead Captured: ${lead.fullName || 'Anonymous'} - ${lead.trekName || 'Trek'}`,
            html: emailHtml
        });
        console.log(`✉️ Abandoned booking lead email sent for ${lead.fullName}`);
    } catch (err) {
        console.error('[SEND LEAD EMAIL ERROR]', err);
    }
}

// --- LEADS MANAGEMENT ROUTES ---
app.post(['/leads', '/api/leads'], async (req, res) => {
    const { leadSessionId, fullName, mobileNumber, userEmail, trekName, bookingDate, participants } = req.body;
    if (!leadSessionId) {
        return res.status(400).json({ message: 'leadSessionId is required' });
    }

    try {
        // Find if lead already exists to see if email has been sent
        const [existing] = await pool.query('SELECT emailSent, status FROM leads WHERE leadSessionId = ?', [leadSessionId]);
        
        let emailSent = 0;
        let status = 'abandoned';
        
        if (existing.length > 0) {
            emailSent = existing[0].emailSent;
            status = existing[0].status;
        }

        // Format date properly for mysql or null if empty
        const formattedDate = bookingDate ? bookingDate : null;

        // Perform the insert or update
        await pool.query(
            `INSERT INTO leads (leadSessionId, fullName, mobileNumber, userEmail, trekName, bookingDate, participants, status, emailSent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
                fullName = VALUES(fullName), 
                mobileNumber = VALUES(mobileNumber), 
                userEmail = VALUES(userEmail), 
                trekName = VALUES(trekName), 
                bookingDate = VALUES(bookingDate), 
                participants = VALUES(participants)`,
            [leadSessionId, fullName, mobileNumber, userEmail, trekName, formattedDate, participants || 1, status, emailSent]
        );

        // If email hasn't been sent, and we have both name and mobile number, send email notification
        if (emailSent === 0 && fullName && fullName.trim() !== '' && mobileNumber && mobileNumber.trim() !== '') {
            // Update emailSent first to prevent double sending if multiple requests hit concurrently
            await pool.query('UPDATE leads SET emailSent = 1 WHERE leadSessionId = ?', [leadSessionId]);
            
            // Send the email asynchronously
            sendLeadEmail({ fullName, mobileNumber, userEmail, trekName, bookingDate, participants });
        }

        res.json({ message: 'Lead synchronized successfully' });
    } catch (err) {
        console.error('[LEADS POST ERROR]', err);
        res.status(500).json({ message: 'Error syncing lead' });
    }
});

app.get(['/admin/leads', '/api/admin/leads'], async (req, res) => {
    if (dbStatus !== 'UP') return res.status(503).json({ message: 'Database offline' });
    try {
        const [l] = await pool.query('SELECT * FROM leads ORDER BY updatedAt DESC');
        res.json(l);
    } catch (err) { 
        console.error('[LEADS GET ERROR]', err);
        res.status(500).json({ message: 'Leads error' }); 
    }
});

// --- BOOKING & PAYMENT ROUTES ---

// 1. Create Razorpay Order (Optional 30% advance payment or full payment)
app.post(['/create-order', '/api/create-order'], async (req, res) => {
    const { amount, paymentMode } = req.body;
    try {
        // Calculate amount to pay online (100% or 30%)
        const chargeAmount = paymentMode === 'full' ? amount : Math.round(amount * 0.30);
        const options = {
            amount: Math.round(chargeAmount * 100), // in paise
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json({
            orderId: order.id,
            amount: order.amount,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('[CREATE ORDER ERROR]', err);
        res.status(500).send('Error creating Razorpay order');
    }
});
app.post(['/verify-payment', '/api/verify-payment'], async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingData } = req.body;
    
    // Normalize email to lowercase
    const normalizedEmail = bookingData.userEmail.toLowerCase().trim();

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature === razorpay_signature) {
        try {
            // Read paymentMode (default to 'advance' for backward compatibility)
            const paymentMode = bookingData.paymentMode || 'advance';
            const amountPaid = paymentMode === 'full' ? Number(bookingData.totalCost) : Math.round(bookingData.totalCost * 0.30);
            const balanceDue = bookingData.totalCost - amountPaid;
            const paymentStatus = paymentMode === 'full' ? 'fully_paid' : 'partially_paid';

            // Save to database
            const [result] = await pool.query(
                `INSERT INTO bookings (
                    userEmail, fullName, mobileNumber, trekName, bookingDate, 
                    participants, totalCost, amountPaid, paymentStatus, razorpay_order_id, razorpay_payment_id, razorpay_signature
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    normalizedEmail, bookingData.fullName, bookingData.mobileNumber, 
                    bookingData.trekName, bookingData.bookingDate, bookingData.participants, 
                    bookingData.totalCost, amountPaid, paymentStatus, razorpay_order_id, razorpay_payment_id, razorpay_signature
                ]
            );

            // Update lead status to booked if leadSessionId is present
            if (bookingData.leadSessionId) {
                try {
                    await pool.query(
                        "UPDATE leads SET status = 'booked' WHERE leadSessionId = ?",
                        [bookingData.leadSessionId]
                    );
                } catch (leadErr) {
                    console.error('[LEADS UPDATE ERROR]', leadErr);
                }
            }

            // Send CONFIRMATION EMAIL
            const emailHtml = paymentMode === 'full' ? `
            <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white; border-radius: 10px;">
                <h2 style="color: #FFD700;">HIKERS HORIZON — BOOKING CONFIRMED</h2>
                <p>Hi ${bookingData.fullName}, your booking for <b>${bookingData.trekName}</b> is successful! We have received your full payment.</p>
                <p><b>Date:</b> ${new Date(bookingData.bookingDate).toDateString()}</p>
                <p><b>Participants:</b> ${bookingData.participants}</p>
                <p><b>Total Cost:</b> ₹${bookingData.totalCost}</p>
                <p><b>Amount Paid (Full):</b> ₹${amountPaid}</p>
                <p style="font-size: 16px; color: #55FF55; font-weight: bold;"><b>Remaining Balance:</b> ₹0 (Fully Paid)</p>
                <hr style="border: 0; border-top: 1px solid #1e293b;">
                <p style="font-size: 12px; color: #94a3b8;">Payment ID: ${razorpay_payment_id}</p>
            </div>` : `
            <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white; border-radius: 10px;">
                <h2 style="color: #FFD700;">HIKERS HORIZON — BOOKING CONFIRMED (30% ADVANCE PAID)</h2>
                <p>Hi ${bookingData.fullName}, your booking for <b>${bookingData.trekName}</b> is successful with a 30% advance payment!</p>
                <p><b>Date:</b> ${new Date(bookingData.bookingDate).toDateString()}</p>
                <p><b>Participants:</b> ${bookingData.participants}</p>
                <p><b>Total Cost:</b> ₹${bookingData.totalCost}</p>
                <p><b>Advance Paid (30%):</b> ₹${amountPaid}</p>
                <p style="font-size: 16px; color: #FFD700; font-weight: bold;"><b>Remaining Balance (Pay on Departure):</b> ₹${balanceDue}</p>
                <hr style="border: 0; border-top: 1px solid #1e293b;">
                <p style="font-size: 12px; color: #94a3b8;">Payment ID: ${razorpay_payment_id}</p>
            </div>`;

            await transporter.sendMail({
                from: `"Hikers Horizon" <${process.env.EMAIL_USER}>`,
                to: normalizedEmail,
                subject: `Expedition Confirmed! — ${bookingData.trekName}`,
                html: emailHtml
            });

            res.json({ message: 'Success', bookingId: result.insertId });
        } catch (dbErr) {
            console.error('[BOOKING DB ERROR]', dbErr);
            res.status(500).json({ message: 'Payment verified but failed to save booking' });
        }
    } else {
        res.status(400).send('Invalid signature');
    }
});

// --- AUTHENTICATION ROUTES ---

app.post(['/signup', '/api/signup'], async (req, res) => {
    const { username, email, password, mobile } = req.body;
    const lowerEmail = email.toLowerCase().trim();
    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, email, password, mobile, otp, otp_expiry, verified) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE otp=?, otp_expiry=?',
            [username, lowerEmail, hashedPassword, mobile, otp, otpExpiry, 0, otp, otpExpiry]
        );
        await transporter.sendMail({
            from: `"Hikers Horizon" <${process.env.EMAIL_USER}>`,
            to: lowerEmail,
            subject: 'Verify Your Hikers Horizon Account',
            text: `Your OTP is: ${otp}`
        });
        res.json({ message: 'OTP sent' });
    } catch (err) { res.status(500).json({ message: 'Signup error' }); }
});

app.post(['/verify-otp', '/api/verify-otp'], async (req, res) => {
    const { email, otp } = req.body;
    const lowerEmail = email.toLowerCase().trim();
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [lowerEmail]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        
        const user = users[0];
        if (user.verified) return res.status(400).json({ message: 'User already verified' });
        if (!user.otp || user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ message: 'OTP has expired' });

        await pool.query('UPDATE users SET verified = 1, otp = NULL, otp_expiry = NULL WHERE email = ?', [lowerEmail]);
        res.json({ message: 'Verification successful' });
    } catch (err) { 
        console.error('[VERIFY OTP ERROR]', err);
        res.status(500).json({ message: 'Verification error' }); 
    }
});

app.post(['/login', '/api/login'], async (req, res) => {
    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase().trim();
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [lowerEmail]);
        if (users.length === 0) return res.status(401).json({ message: 'User not found' });
        if (!users[0].verified) return res.status(401).json({ message: 'Please verify email' });
        const isMatch = await bcrypt.compare(password, users[0].password);
        if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });
        res.json({ message: 'Login successful', username: users[0].username, email: users[0].email });
    } catch (err) { res.status(500).json({ message: 'Login error' }); }
});

// --- MOBILE LOGIN ROUTES ---

app.post(['/send-mobile-otp', '/api/send-mobile-otp'], async (req, res) => {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: 'Mobile number required' });

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE mobile = ?', [mobile]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Mobile number not registered. Please sign up first.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query('UPDATE users SET mobile_otp = ?, mobile_otp_expiry = ? WHERE mobile = ?', [otp, otpExpiry, mobile]);

        // Call the WhatsApp Bot API via Cloud Sync Queue
        try {
            // Push the OTP command to the sync queue so the Termux bot picks it up
            botCommandQueue.push({ type: 'send_otp', payload: { number: mobile, otp: otp } });
            res.json({ message: 'OTP queued for WhatsApp delivery' });
        } catch (botErr) {
            console.error('[BOT QUEUE ERROR]', botErr.message);
            res.status(500).json({ message: 'Failed to queue OTP. Please try again later.' });
        }
    } catch (err) {
        console.error('[SEND MOBILE OTP ERROR]', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post(['/verify-mobile-otp', '/api/verify-mobile-otp'], async (req, res) => {
    const { mobile, otp } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE mobile = ?', [mobile]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        
        const user = users[0];
        if (!user.mobile_otp || user.mobile_otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        if (new Date() > new Date(user.mobile_otp_expiry)) {
            return res.status(400).json({ message: 'OTP has expired' });
        }

        // Clear OTP on success
        await pool.query('UPDATE users SET mobile_otp = NULL, mobile_otp_expiry = NULL WHERE mobile = ?', [mobile]);

        res.json({ message: 'Login successful', username: user.username, email: user.email });
    } catch (err) {
        console.error('[VERIFY MOBILE OTP ERROR]', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// --- PROFILE ROUTE ---
app.get(['/profile/:email([^\/]+)', '/api/profile/:email([^\/]+)'], async (req, res) => {
    if (dbStatus !== 'UP') return res.status(503).json({ message: 'Database connecting...' });
    const email = req.params.email.toLowerCase().trim();
    try {
        const [users] = await pool.query('SELECT username, email, verified, createdAt FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        const [bookings] = await pool.query('SELECT * FROM bookings WHERE userEmail = ? ORDER BY createdAt DESC', [email]);
        res.json({ user: users[0], bookings });
    } catch (err) { res.status(500).json({ message: 'Error fetching profile' }); }
});

app.put(['/profile/:email([^\/]+)', '/api/profile/:email([^\/]+)'], async (req, res) => {
    const { email } = req.params;
    const { username } = req.body;
    try {
        await pool.query('UPDATE users SET username = ? WHERE email = ?', [username, email]);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error('[PROFILE UPDATE ERROR]', err.message);
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// --- CONTACT & INQUIRY ROUTES ---
app.post(['/contact', '/api/contact'], async (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    try {
        await pool.query(
            'INSERT INTO queries (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
            [name, email, phone, subject, message]
        );
        res.json({ message: 'Message sent successfully' });
    } catch (err) {
        console.error('[CONTACT ERROR]', err.message);
        res.status(500).json({ message: 'Error saving query' });
    }
});

// --- NEWSLETTER SUBSCRIPTION ---
app.post(['/subscribe', '/api/subscribe'], async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    try {
        await pool.query(
            'INSERT IGNORE INTO subscribers (email) VALUES (?)',
            [email.toLowerCase().trim()]
        );
        res.json({ message: 'Subscribed successfully' });
    } catch (err) {
        console.error('[SUBSCRIBE ERROR]', err.message);
        res.status(500).json({ message: 'Error subscribing' });
    }
});

// --- ADMIN API ROUTES ---
app.post(['/admin/login', '/api/admin/login'], async (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    if ((cleanEmail === 'hikershorizon@gmail.com' || cleanEmail === 'venturesven@gmail.com') && password === 'Asdf@2003') return res.json({ message: 'Admin login' });
    res.status(401).json({ message: 'Unauthorized' });
});

app.get(['/admin/stats', '/api/admin/stats'], async (req, res) => {
    if (dbStatus !== 'UP') return res.status(503).json({ message: 'Database offline' });
    try {
        const [[{ tUsers }]] = await pool.query('SELECT COUNT(*) as tUsers FROM users');
        const [[{ vUsers }]] = await pool.query('SELECT COUNT(*) as vUsers FROM users WHERE verified = 1');
        const [[{ tBookings }]] = await pool.query('SELECT COUNT(*) as tBookings FROM bookings');
        const [[{ tQueries }]] = await pool.query('SELECT COUNT(*) as tQueries FROM queries');
        
        const [[{ tLeads }]] = await pool.query("SELECT COUNT(*) as tLeads FROM leads WHERE status = 'abandoned'");
        
        // Calculate Collected Revenues (based on actual amountPaid)
        const [[{ totalRevenue }]] = await pool.query('SELECT COALESCE(SUM(amountPaid), 0) as totalRevenue FROM bookings');
        const [[{ todayRevenue }]] = await pool.query('SELECT COALESCE(SUM(amountPaid), 0) as todayRevenue FROM bookings WHERE DATE(createdAt) = CURDATE()');
        const [[{ weekRevenue }]] = await pool.query('SELECT COALESCE(SUM(amountPaid), 0) as weekRevenue FROM bookings WHERE YEARWEEK(createdAt, 1) = YEARWEEK(CURDATE(), 1)');
        const [[{ monthRevenue }]] = await pool.query('SELECT COALESCE(SUM(amountPaid), 0) as monthRevenue FROM bookings WHERE MONTH(createdAt) = MONTH(CURDATE()) AND YEAR(createdAt) = YEAR(CURDATE())');
        
        res.json({ 
            totalUsers: tUsers, 
            verifiedUsers: vUsers, 
            unverifiedUsers: tUsers - vUsers, 
            totalBookings: tBookings,
            totalQueries: tQueries,
            todayRevenue: Number(todayRevenue),
            weekRevenue: Number(weekRevenue),
            monthRevenue: Number(monthRevenue),
            totalRevenue: Number(totalRevenue),
            totalLeads: tLeads
        });
    } catch (err) { 
        console.error('[STATS ERROR]', err.message);
        res.status(500).json({ message: 'Stats error' }); 
    }
});

app.get(['/admin/queries', '/api/admin/queries'], async (req, res) => {
    if (dbStatus !== 'UP') return res.status(503).json({ message: 'Database offline' });
    try {
        const [q] = await pool.query('SELECT * FROM queries ORDER BY createdAt DESC');
        res.json(q);
    } catch (err) { res.status(500).json({ message: 'Queries error' }); }
});

app.get(['/admin/users', '/api/admin/users'], async (req, res) => {
    if (dbStatus !== 'UP') return res.status(503).json({ message: 'Database offline' });
    try {
        const [u] = await pool.query('SELECT username, email, mobile, verified, createdAt FROM users ORDER BY createdAt DESC');
        res.json(u);
    } catch (err) { 
        console.error('[USERS ERROR]', err.message);
        res.status(500).json({ message: 'Users error' }); 
    }
});

app.get(['/admin/bookings', '/api/admin/bookings'], async (req, res) => {
    if (dbStatus !== 'UP') return res.status(503).json({ message: 'Database offline' });
    try {
        const [b] = await pool.query('SELECT * FROM bookings ORDER BY createdAt DESC');
        res.json(b);
    } catch (err) { 
        console.error('[BOOKINGS ERROR]', err.message);
        res.status(500).json({ message: 'Bookings error' }); 
    }
});

// Settle partial payment for a booking
app.post(['/admin/bookings/:id/settle', '/api/admin/bookings/:id/settle'], async (req, res) => {
    if (dbStatus !== 'UP') return res.status(503).json({ message: 'Database offline' });
    const { id } = req.params;
    try {
        // Fetch booking to verify it exists
        const [booking] = await pool.query('SELECT totalCost FROM bookings WHERE id = ?', [id]);
        if (booking.length === 0) return res.status(404).json({ message: 'Booking not found' });
        
        // Update to fully paid and update amountPaid to match totalCost
        await pool.query(
            "UPDATE bookings SET paymentStatus = 'fully_paid', amountPaid = totalCost WHERE id = ?",
            [id]
        );
        res.json({ message: 'Booking settled successfully' });
    } catch (err) {
        console.error('[SETTLE BOOKING ERROR]', err.message);
        res.status(500).json({ message: 'Error settling booking' });
    }
});

// --- ADMIN WHATSAPP BOT STATE (Polling Architecture) ---
let botState = {
    status: 'offline',
    qr: null,
    uptime: 0,
    lastSync: 0,
    blacklist: [],
    customers: [],
    logs: []
};
const botCommandQueue = [];

// Dashboard Endpoints (Fetching State)
app.get(['/admin/bot/status', '/api/admin/bot/status'], (req, res) => {
    if (Date.now() - botState.lastSync > 15000) botState.status = 'offline';
    res.json({ status: botState.status, qr: botState.qr, uptime: botState.uptime });
});

app.get(['/admin/bot/blacklist', '/api/admin/bot/blacklist'], (req, res) => {
    res.json(botState.blacklist);
});

app.get(['/admin/bot/customers', '/api/admin/bot/customers'], (req, res) => {
    res.json(botState.customers);
});

app.get(['/admin/bot/logs', '/api/admin/bot/logs'], (req, res) => {
    res.json(botState.logs);
});

// Dashboard Endpoints (Sending Commands)
app.post(['/admin/bot/blacklist', '/api/admin/bot/blacklist'], (req, res) => {
    botCommandQueue.push({ type: 'blacklist_add', payload: { number: req.body.number } });
    res.json({ success: true, queued: true });
});

app.delete(['/admin/bot/blacklist/:number', '/api/admin/bot/blacklist/:number'], (req, res) => {
    botCommandQueue.push({ type: 'blacklist_remove', payload: { number: req.params.number } });
    res.json({ success: true, queued: true });
});

app.post(['/admin/bot/broadcast', '/api/admin/bot/broadcast'], (req, res) => {
    botCommandQueue.push({ type: 'broadcast', payload: { message: req.body.message } });
    res.json({ success: true, queued: true });
});

// Bot Sync Endpoint (Used by the mobile bot)
app.post('/api/bot/sync', (req, res) => {
    const { status, qr, uptime, blacklist, customers, logs } = req.body;
    botState = {
        status: status || 'offline',
        qr: qr || null,
        uptime: uptime || 0,
        blacklist: blacklist || [],
        customers: customers || [],
        logs: logs || [],
        lastSync: Date.now()
    };
    
    const commands = [...botCommandQueue];
    botCommandQueue.length = 0; // Clear the queue after sending
    res.json({ commands });
});


// --- STATIC FILE SERVING ---
const cpanelPath = path.join(__dirname, '..', 'public_html');
const localPath = path.join(__dirname, 'public');
const publicDir = fs.existsSync(cpanelPath) ? cpanelPath : localPath;

// --- MULTI-DOMAIN ROUTING FOR GOKARNA CAMPAIGNS ---
// Serves Gokarna beach trek page as the homepage for gokarn.online and gokarnabeachtrek.in
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.includes('gokarn.online') || host.includes('gokarnabeachtrek.in')) {
    if (req.path === '/' || req.path === '/index.html') {
      return res.sendFile(path.join(publicDir, 'Twodays', 'Gokarna', 'index.html'));
    }
    if (req.path === '/booking' || req.path === '/booking-gokarna' || req.path === '/booking-gokarna.html') {
      return res.sendFile(path.join(publicDir, 'booking-gokarna.html'));
    }
  }
  next();
});

// Dynamic robots.txt and sitemap.xml for campaigns
app.get('/robots.txt', (req, res, next) => {
  const host = req.headers.host || '';
  if (host.includes('gokarn.online') || host.includes('gokarnabeachtrek.in')) {
    const domain = host.includes('gokarn.online') ? 'gokarn.online' : 'gokarnabeachtrek.in';
    res.type('text/plain');
    return res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\n\nSitemap: https://${domain}/sitemap.xml`);
  }
  next();
});

app.get('/sitemap.xml', (req, res, next) => {
  const host = req.headers.host || '';
  if (host.includes('gokarn.online') || host.includes('gokarnabeachtrek.in')) {
    const domain = host.includes('gokarn.online') ? 'gokarn.online' : 'gokarnabeachtrek.in';
    res.type('application/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://${domain}/</loc>
    <lastmod>2026-05-27</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>https://${domain}/img/gokarna1.jpg</image:loc>
      <image:title>Gokarna beach trek - Hikers Horizon</image:title>
      <image:caption>Trekkers walking on Om Beach during Gokarna coastal trail from Bangalore</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://${domain}/img/gokarna2.jpg</image:loc>
      <image:title>Half Moon Beach Gokarna</image:title>
      <image:caption>Hidden beach discovered during 2-day Gokarna trekking expedition</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://${domain}/img/gokarna3.jpg</image:loc>
      <image:title>Sunset at Paradise Beach Gokarna</image:title>
      <image:caption>Scenic view during Gokarna coastal trek</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://${domain}/img/gokarna4.jpg</image:loc>
      <image:title>Gokarna beach camping and trek group</image:title>
      <image:caption>Hikers Horizon Gokarna beach camping and trek group from Bangalore</image:caption>
    </image:image>
  </url>
  <url>
    <loc>https://${domain}/booking</loc>
    <lastmod>2026-05-27</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://${domain}/Blog/Gokarna-Beach-Trek-Itinerary-from-Bangalore</loc>
    <lastmod>2026-05-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`);
  }
  next();
});

app.use(express.static(publicDir));

// --- ADMIN PAGE ROUTES ---
app.get(['/admin', '/admin-dashboard'], (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-dashboard.html'));
});

// --- EXTENSION-LESS ROUTING (Wildcard) ---
app.get('*', (req, res, next) => {
  if (req.path.includes('.') || req.path === '/') return next();
  
  // Strip leading/trailing slashes for clean file system checks
  const cleanPath = req.path.replace(/^\/+|\/+$/g, '');
  
  // 1. Direct HTML file check (e.g., about.html for /About)
  const htmlPath = path.join(publicDir, `${cleanPath}.html`);
  if (fs.existsSync(htmlPath) && !fs.lstatSync(htmlPath).isDirectory()) {
    return res.sendFile(htmlPath);
  }
  
  // 2. Directory with index.html check (e.g., Sunrise/Skandagiri/index.html for /Sunrise/Skandagiri)
  const indexPath = path.join(publicDir, cleanPath, 'index.html');
  if (fs.existsSync(indexPath) && !fs.lstatSync(indexPath).isDirectory()) {
    return res.sendFile(indexPath);
  }
  
  next();
});

app.get('/', (req, res) => { res.sendFile(path.join(publicDir, 'index.html')); });



// --- START SERVER ---
// Start DB initialization immediately
initDatabase();

if (require.main === module) {
    app.listen(PORT, HOST, () => {
        console.log(`🚀 Hikers Horizon Server active at http://${HOST}:${PORT}`);
    });
}

// Export for Passenger/cPanel entry point support
module.exports = app;
