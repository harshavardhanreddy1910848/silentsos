import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '465');
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

console.log('Testing SMTP configuration:');
console.log('Host:', smtpHost);
console.log('Port:', smtpPort);
console.log('User:', smtpUser);
console.log('Password length:', smtpPass ? smtpPass.length : 0);

if (!smtpUser || !smtpPass) {
  console.error('Error: SMTP_USER or SMTP_PASS is missing in .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});

try {
  console.log('Verifying transporter connection...');
  await transporter.verify();
  console.log('✅ SMTP Connection verified successfully!');
  
  console.log('Sending test email...');
  const info = await transporter.sendMail({
    from: `"SilentSOS Test" <${smtpUser}>`,
    to: smtpUser,
    subject: '🚨 SilentSOS SMTP Test Connection 🚨',
    text: 'If you receive this email, your SilentSOS SMTP transporter configuration works correctly!',
    html: '<h3>If you receive this email, your SilentSOS SMTP transporter configuration works correctly!</h3>'
  });
  console.log('✅ Email sent successfully! MessageID:', info.messageId);
} catch (err) {
  console.error('❌ SMTP verification/sending failed:', err);
}
