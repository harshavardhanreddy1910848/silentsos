import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import dns from 'dns';

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

function resolveHostToIPv4(host) {
  return new Promise((resolve) => {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      return resolve(host);
    }
    dns.resolve4(host, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        console.warn(`⚠️ Failed to resolve host ${host} to IPv4:`, err ? err.message : 'no addresses');
        resolve(host);
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

try {
  const resolvedHost = await resolveHostToIPv4(smtpHost);
  console.log(`✉️ Resolved SMTP host ${smtpHost} to IPv4 address: ${resolvedHost}`);

  console.log('Verifying transporter connection...');
  const transporter = nodemailer.createTransport({
    host: resolvedHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      servername: smtpHost
    }
  });

  await transporter.verify();
  console.log('✅ SMTP Connection verified successfully!');
  
  console.log('Sending test email...');
  const info = await transporter.sendMail({
    from: `"SilentSOS Test" <${smtpUser}>`,
    to: smtpUser,
    subject: '🚨 SilentSOS SMTP IPv4 Test 🚨',
    text: 'If you receive this email, your SilentSOS SMTP transporter configuration works correctly over IPv4!',
    html: '<h3>If you receive this email, your SilentSOS SMTP transporter configuration works correctly over IPv4!</h3>'
  });
  console.log('✅ Email sent successfully! MessageID:', info.messageId);
} catch (err) {
  console.error('❌ SMTP verification/sending failed:', err);
}
