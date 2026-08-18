const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'hikershorizon@gmail.com',
    pass: process.env.EMAIL_PASS || 'fdbblairzahobjzu'
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendBookingConfirmation({
  toEmail,
  fullName,
  trekName,
  bookingDate,
  participants = 1,
  totalCost,
  amountPaid,
  paymentMode = 'advance', // 'advance' or 'full'
  paymentId = `PAY_${Date.now()}`
}) {
  const isAdvance = paymentMode === 'advance';
  const balanceDue = Number(totalCost) - Number(amountPaid);
  const formattedDate = new Date(bookingDate).toDateString();

  const paymentSummaryHtml = isAdvance ? `
    <p style="margin: 0 0 8px 0;"><b>Payment Mode:</b> 30% Advance Paid Online</p>
    <p style="margin: 0 0 8px 0; color: #10b981;"><b>Advance Paid Now:</b> ₹${Number(amountPaid).toLocaleString('en-IN')}</p>
    <p style="margin: 0 0 8px 0; color: #f59e0b;"><b>Balance Due (at departure):</b> ₹${Number(balanceDue).toLocaleString('en-IN')}</p>
  ` : `
    <p style="margin: 0 0 8px 0;"><b>Payment Mode:</b> 100% Full Payment</p>
    <p style="margin: 0 0 8px 0; color: #10b981;"><b>Amount Paid:</b> ₹${Number(amountPaid).toLocaleString('en-IN')} (Fully Paid)</p>
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
      <div style="background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center;">
        <h2 style="color: #fbbf24; margin: 0; font-size: 24px; letter-spacing: 1px;">Hikers Horizon</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Explore The Unexplored</p>
      </div>
      <div style="padding: 24px;">
        <h3 style="color: #059669; margin-top: 0; font-size: 20px;">🎉 Booking Confirmed!</h3>
        <p>Hi <b>${fullName}</b>,</p>
        <p>Thank you for choosing Hikers Horizon! Your booking for <b>${trekName}</b> is successfully confirmed.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #fbbf24; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0;"><b>Trek:</b> ${trekName}</p>
          <p style="margin: 0 0 8px 0;"><b>Date of Trek:</b> ${formattedDate}</p>
          <p style="margin: 0 0 8px 0;"><b>Participants:</b> ${participants} Person(s)</p>
          <p style="margin: 0 0 8px 0;"><b>Total Trek Cost:</b> ₹${Number(totalCost).toLocaleString('en-IN')}</p>
          ${paymentSummaryHtml}
          <p style="margin: 0; font-size: 12px; color: #64748b;"><b>Transaction Ref:</b> ${paymentId}</p>
        </div>

        <p>Our trek coordinator will contact you via WhatsApp / Call 24 hours prior to departure with pickup points, coordinator contact, and checklist.</p>
        <p>If you have any questions, reply directly to this email or reach us on WhatsApp: <b>+91 81230 45828</b>.</p>
        <br/>
        <p style="margin-bottom: 0;">Happy Trekking,<br/><b>Team Hikers Horizon</b></p>
      </div>
    </div>
  `;

  console.log(`📧 Sending confirmation email to: ${toEmail}...`);
  const info = await transporter.sendMail({
    from: `"Hikers Horizon" <${process.env.EMAIL_USER || 'hikershorizon@gmail.com'}>`,
    to: toEmail,
    subject: `Booking Confirmed: ${trekName} — Hikers Horizon`,
    html
  });

  console.log('✅ Email sent successfully! MessageId:', info.messageId);

  // Also insert into database if connected
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    await pool.query(
      `INSERT INTO bookings (
        userEmail, fullName, mobileNumber, trekName, bookingDate, 
        participants, totalCost, amountPaid, paymentStatus, razorpay_payment_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toEmail,
        fullName,
        '',
        trekName,
        new Date(bookingDate),
        participants,
        totalCost,
        amountPaid,
        isAdvance ? 'partially_paid' : 'fully_paid',
        paymentId
      ]
    );
    console.log('✅ Recorded in database bookings table.');
    await pool.end();
  } catch (dbErr) {
    console.log('ℹ️ DB sync notice:', dbErr.message);
  }
}

// Check if running from CLI with args
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
Usage:
  node send_confirmation.js <email> <fullName> <trekName> <bookingDate> <participants> <totalCost> <amountPaid> [paymentMode] [paymentId]

Example:
  node send_confirmation.js customer@gmail.com "Rahul Sharma" "Kudremukh Trek" "2026-08-23" 2 6998 2099 advance PAY_12345
    `);
  } else {
    sendBookingConfirmation({
      toEmail: args[0],
      fullName: args[1],
      trekName: args[2],
      bookingDate: args[3],
      participants: parseInt(args[4]) || 1,
      totalCost: parseFloat(args[5]),
      amountPaid: parseFloat(args[6]),
      paymentMode: args[7] || 'advance',
      paymentId: args[8] || `MANUAL_${Date.now()}`
    }).catch(err => console.error('❌ Error sending email:', err));
  }
}

module.exports = { sendBookingConfirmation };
