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
        mobile VARCHAR(20),
        otp VARCHAR(10),
        otp_expiry DATETIME,
        verified TINYINT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        razorpay_signature VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
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

// --- BOOKING & PAYMENT ROUTES ---

// 1. Create Razorpay Order
app.post(['/create-order', '/api/create-order'], async (req, res) => {
    const { amount } = req.body;
    try {
        const options = {
            amount: Math.round(amount * 100),
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

// 2. Verify Payment & Save Booking
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
            // Save to database
            const [result] = await pool.query(
                `INSERT INTO bookings (
                    userEmail, fullName, mobileNumber, trekName, bookingDate, 
                    participants, totalCost, razorpay_order_id, razorpay_payment_id, razorpay_signature
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    normalizedEmail, bookingData.fullName, bookingData.mobileNumber, 
                    bookingData.trekName, bookingData.bookingDate, bookingData.participants, 
                    bookingData.totalCost, razorpay_order_id, razorpay_payment_id, razorpay_signature
                ]
            );

            // Send CONFIRMATION EMAIL
            const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white; border-radius: 10px;">
                <h2 style="color: #FFD700;">HIKERS HORIZON — BOOKING CONFIRMED</h2>
                <p>Hi ${bookingData.fullName}, your booking for <b>${bookingData.trekName}</b> is successful!</p>
                <p><b>Date:</b> ${new Date(bookingData.bookingDate).toDateString()}</p>
                <p><b>Participants:</b> ${bookingData.participants}</p>
                <p><b>Total Paid:</b> ₹${bookingData.totalCost}</p>
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

// --- ADMIN API ROUTES ---
app.post(['/admin/login', '/api/admin/login'], async (req, res) => {
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
        
        res.json({ 
            totalUsers: tUsers, 
            verifiedUsers: vUsers, 
            unverifiedUsers: tUsers - vUsers, 
            totalBookings: tBookings,
            totalQueries: tQueries,
            todayRevenue: 0,
            weekRevenue: 0,
            monthRevenue: 0,
            totalRevenue: 0
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


// --- STATIC FILE SERVING ---
const cpanelPath = path.join(__dirname, '..', 'public_html');
const localPath = path.join(__dirname, 'public');
const publicDir = fs.existsSync(cpanelPath) ? cpanelPath : localPath;
app.use(express.static(publicDir));

// --- ADMIN PAGE ROUTES ---
app.get(['/admin', '/admin-dashboard'], (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-dashboard.html'));
});

// --- EXTENSION-LESS ROUTING (Wildcard) ---
app.get('*', (req, res, next) => {
  if (req.path.includes('.') || req.path === '/') return next();
  const cleanPath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const htmlPath = path.join(publicDir, `${cleanPath}.html`);
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
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
