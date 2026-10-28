import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { fileURLToPath } from 'url';
import { db, initDb, pool } from './db.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Prefer IPv4 on Windows to prevent ENOTFOUND on dual-stack networks
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Setup directories
const EVIDENCE_DIR = path.join(__dirname, 'evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, EVIDENCE_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}-${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

let mailTransporter = null;
let lastMailError = null;
const sentEvidenceAlerts = new Set();
const activeAlertTimers = new Map();
const activeAlertIntervals = new Map();
const lastPeriodicEmailTime = new Map();

function clearAlertTimersAndIntervals(alertId) {
  if (activeAlertTimers.has(alertId)) {
    clearTimeout(activeAlertTimers.get(alertId));
    activeAlertTimers.delete(alertId);
  }
  if (activeAlertIntervals.has(alertId)) {
    clearInterval(activeAlertIntervals.get(alertId));
    activeAlertIntervals.delete(alertId);
  }
}

// Initialize mail transporter (SMTP fallback)
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const smtpHost = process.env.SMTP_HOST || 'smtp.resend.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465');
  const smtpUser = process.env.SMTP_USER || 'resend';
  const smtpPass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;

  if (smtpUser && smtpPass) {
    mailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    console.log(`✉️ Nodemailer SMTP configured using: ${smtpHost}:${smtpPort} (user: ${smtpUser})`);
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      mailTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`✉️ Nodemailer configured with Ethereal Test SMTP. User: ${testAccount.user}`);
    } catch (err) {
      console.error('❌ Failed to create Ethereal SMTP account:', err);
    }
  }

  return mailTransporter;
}

// Unified Email Sender powered by Resend REST API with Sandbox fallback & SMTP backup
async function sendEmailViaResend({ to, subject, html, attachments = [] }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'SilentSOS <onboarding@resend.dev>';
  const sandboxEmail = process.env.RESEND_SANDBOX_EMAIL || 'sheshadrihvr@gmail.com';

  // Format attachments for Resend REST API: array of { filename, content: base64 }
  const resendAttachments = [];
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att.content) {
        resendAttachments.push({
          filename: att.filename || 'attachment.dat',
          content: typeof att.content === 'string' ? att.content : Buffer.from(att.content).toString('base64')
        });
      } else if (att.path && fs.existsSync(att.path)) {
        try {
          const fileBuf = fs.readFileSync(att.path);
          // Only attach files under 10MB to comply with payload constraints
          if (fileBuf.length < 10 * 1024 * 1024) {
            resendAttachments.push({
              filename: att.filename || path.basename(att.path),
              content: fileBuf.toString('base64')
            });
          }
        } catch (e) {
          console.warn(`Could not read attachment file ${att.path}:`, e.message);
        }
      }
    }
  }

  // 1. Primary: Resend REST API
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html,
        attachments: resendAttachments.length > 0 ? resendAttachments : undefined
      })
    });

    const data = await res.json();

    if (res.ok && data.id) {
      console.log(`✉️ [Resend API] Email successfully delivered to ${to} (Message ID: ${data.id})`);
      return { success: true, id: data.id, recipient: to, forwarded: false };
    }

    // 2. Resend Sandbox Mode check (free onboarding@resend.dev only allows sending to the account owner)
    const isSandboxRestriction = !res.ok && (
      res.status === 403 || 
      res.status === 422 || 
      (data.message && (data.message.includes('testing emails') || data.message.includes('Invalid `to` field')))
    );

    if (isSandboxRestriction && to.toLowerCase() !== sandboxEmail.toLowerCase()) {
      console.warn(`⚠️ [Resend Sandbox Mode] Destination ${to} is external. Forwarding to verified developer email: ${sandboxEmail}`);
      
      const sandboxBanner = `
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-family: Arial, sans-serif; font-size: 13px; color: #92400e; line-height: 1.5;">
          <strong style="color: #b45309; font-size: 14px;">⚠️ RESEND SANDBOX NOTIFICATION FORWARD:</strong><br/>
          This safety notification was originally dispatched to: <strong>${to}</strong>.<br/>
          Because your Resend account is using the free sandbox test domain (<code>onboarding@resend.dev</code>), Resend automatically routed this alert to your verified developer address: <strong>${sandboxEmail}</strong>.<br/>
          <span style="font-size: 11px; color: #a16207;">(To deliver directly to any external emergency contact, add and verify your custom domain on <a href="https://resend.com/domains" style="color: #b45309; text-decoration: underline;">resend.com/domains</a>)</span>
        </div>
      `;

      const forwardedHtml = sandboxBanner + html;
      const forwardedSubject = `[For: ${to}] ${subject}`;

      const retryRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [sandboxEmail],
          subject: forwardedSubject,
          html: forwardedHtml,
          attachments: resendAttachments.length > 0 ? resendAttachments : undefined
        })
      });

      const retryData = await retryRes.json();
      if (retryRes.ok && retryData.id) {
        console.log(`✉️ [Resend API Forwarded] Delivered to sandbox address ${sandboxEmail} (ID: ${retryData.id}) for recipient: ${to}`);
        return { success: true, id: retryData.id, recipient: sandboxEmail, forwarded: true, originalRecipient: to };
      } else {
        console.error('❌ [Resend Forwarding Error]:', retryData);
      }
    } else {
      console.error(`❌ [Resend API Error ${res.status}]:`, data);
    }
  } catch (apiErr) {
    console.error('❌ [Resend API Network Error]:', apiErr.message);
  }

  // 3. Fallback: Nodemailer SMTP
  try {
    const transporter = await getMailTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: fromEmail,
        to: to,
        subject: subject,
        html: html,
        attachments: attachments
      });
      console.log(`✉️ [SMTP Fallback] Email successfully dispatched to ${to} (MessageID: ${info.messageId})`);
      return { success: true, id: info.messageId, recipient: to, method: 'smtp' };
    }
  } catch (smtpErr) {
    lastMailError = { message: smtpErr.message, stack: smtpErr.stack, time: new Date().toISOString() };
    console.error('❌ [SMTP Fallback Error]:', smtpErr.message);
  }

  return { success: false, error: 'Failed to deliver email through Resend API and SMTP fallback.' };
}

// Helpers to dynamically resolve application base URL (for Vercel services, Railway, or local)
function getAppBaseUrl(req = null) {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }
  if (req && req.headers && req.headers.origin) {
    return req.headers.origin.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:5173';
}

function getMediaBaseUrl(req = null) {
  if (process.env.MEDIA_URL) {
    return process.env.MEDIA_URL.replace(/\/$/, '');
  }
  return getAppBaseUrl(req);
}

// Sends alert notification email to emergency contacts with complete medical & profile details
async function sendAlertEmails(user, contacts, alert, isInitial = false) {
  try {
    const alertId = alert.id;
    const timeStr = new Date(alert.timestamp).toLocaleTimeString();
    const dateStr = new Date(alert.timestamp).toLocaleDateString();
    
    const broadcastLink = `${getAppBaseUrl()}/receiver/${alertId}`;
    const latestCoords = alert.gpsPath && alert.gpsPath.length > 0 
      ? alert.gpsPath[alert.gpsPath.length - 1] 
      : null;
    
    if (!latestCoords) {
      console.warn(`⚠️ Alert ${alertId} has no GPS coordinates. Skipping email dispatch.`);
      return;
    }
    
    const googleMapsLink = `https://maps.google.com/?q=${latestCoords.lat},${latestCoords.lng}`;

    // Append global email recipients from administrator settings
    const globalSettings = await db.getSettings('global');
    let extraRecipients = [];
    if (globalSettings && globalSettings.globalEmergencyEmails) {
      const emailList = globalSettings.globalEmergencyEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);
      extraRecipients = emailList.map((email, idx) => ({
        id: `global-recipient-${idx}`,
        name: `Global Emergency Responder`,
        email: email,
        preferences: { gps: true, photos: true, video: true, audio: true, message: true }
      }));
    }

    const emailRecipients = [
      ...contacts.filter(c => c.email),
      ...extraRecipients
    ];

    if (emailRecipients.length === 0) {
      console.log('✉️ No contacts or global emails. Skipping alert email dispatch.');
      return;
    }

    for (const contact of emailRecipients) {
      let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden; background-color: #fafafa;">
          <div style="background-color: #ef4444; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">🚨 SilentSOS EMERGENCY WARNING 🚨</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px;">User <strong>${user.name}</strong> needs immediate assistance</p>
          </div>
          
          <div style="padding: 24px; color: #333333; background-color: #ffffff;">
            <p style="font-size: 16px; margin-top: 0;">Dear ${contact.name},</p>
            <p style="font-size: 14px; line-height: 1.6;">
              This is an automated emergency alert dispatched via <strong>SilentSOS Safety Network (Powered by Resend)</strong>. User <strong>${user.name}</strong> triggered an active distress response.
            </p>
            
            <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px 0; color: #9f1239; font-size: 14px; font-weight: bold;">🚨 ALERT DETAILS:</h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #4c0519;">
                <li><strong>Distress Type:</strong> ${alert.type || 'General Distress'}</li>
                <li><strong>Trigger Date:</strong> ${dateStr}</li>
                <li><strong>Trigger Time:</strong> ${timeStr}</li>
                <li><strong>Current Status:</strong> <span style="background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${alert.status || 'Active'}</span></li>
                <li><strong>GPS Location:</strong> Latitude ${latestCoords.lat.toFixed(6)}, Longitude ${latestCoords.lng.toFixed(6)}</li>
              </ul>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                👤 EMERGENCY USER PROFILE & MEDICAL DETAILS:
              </h3>
              <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse; color: #334155;">
                <tr><td style="padding: 4px 0; font-weight: bold; width: 130px; color: #64748b;">Full Name:</td><td><strong>${user.name}</strong></td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Email:</td><td>${user.email}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Mobile Phone:</td><td>${user.phone ? `<strong>${user.phone}</strong>` : '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Blood Group:</td><td>${user.bloodGroup ? `<span style="background-color:#fee2e2; color:#991b1b; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${user.bloodGroup}</span>` : '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Residential Address:</td><td>${user.address || '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Mother's Name:</td><td>${user.motherName || '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Father's Name:</td><td>${user.fatherName || '<em>Not specified</em>'}</td></tr>
              </table>
            </div>

            <div style="text-align: center; margin: 26px 0 20px 0;">
              <a href="${broadcastLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                🛰️ Track Location & Evidence Live
              </a>
              <p style="margin: 8px 0 0 0;"><a href="${googleMapsLink}" style="color: #ef4444; font-size: 13px; text-decoration: underline; font-weight: bold;">📍 Open Coordinates in Google Maps</a></p>
            </div>
      `;

      const attachments = [];
      
      if (!isInitial && alert.evidence && alert.evidence.files && alert.evidence.files.length > 0) {
        htmlContent += `
            <div style="margin-top: 24px; border-top: 1px solid #e1e1e1; padding-top: 20px;">
              <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: bold;">🔒 RECORDED EVIDENCE ENCLOSED:</h3>
              <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 16px;">
                Recorded photos, audio, and media files are enclosed and attached directly below.
              </p>
              <ul style="font-size: 13px; line-height: 1.6; color: #4b5563; padding-left: 20px;">
        `;

        alert.evidence.files.forEach((file, idx) => {
          const fileUrl = `${getMediaBaseUrl()}${file.url}`;
          htmlContent += `
            <li><strong>${file.type.toUpperCase()}:</strong> <a href="${fileUrl}" style="color: #ef4444; text-decoration: underline;">Open ${file.type} file</a></li>
          `;
          
          const filePath = path.join(EVIDENCE_DIR, path.basename(file.url));
          if (fs.existsSync(filePath)) {
            attachments.push({
              filename: `evidence_${file.type}_${idx + 1}${path.extname(file.url)}`,
              path: filePath
            });
          }
        });

        htmlContent += `
              </ul>
            </div>
        `;
      } else if (isInitial) {
        htmlContent += `
          <p style="font-size: 12px; color: #6b7280; line-height: 1.5; font-style: italic; border-top: 1px solid #e1e1e1; padding-top: 15px;">
            ℹ️ Silent photo, video, and microphone capturing sequences are executing. Media evidence files will be dispatched in a separate update email automatically.
          </p>
        `;
      }

      htmlContent += `
          </div>
          <div style="background-color: #f3f4f6; color: #6b7280; padding: 16px; text-align: center; font-size: 11px; border-top: 1px solid #e1e1e1;">
            This email was dispatched automatically by SilentSOS emergency response network via Resend.<br/>
            Ref Alert ID: ${alertId}
          </div>
        </div>
      `;

      const subject = isInitial 
        ? `🚨 SilentSOS INITIAL WARNING: Emergency alert triggered by ${user.name}` 
        : `🔒 SilentSOS EVIDENCE ENCLOSED: Emergency alert update for ${user.name}`;

      await sendEmailViaResend({
        to: contact.email,
        subject: subject,
        html: htmlContent,
        attachments: attachments
      });
    }
  } catch (err) {
    lastMailError = { message: err.message, stack: err.stack, time: new Date().toISOString() };
    console.error('❌ Failed to send alert emails:', err);
  }
}

// Sends cancellation email when user cancels alert
async function sendCancelEmail(user, contacts, alert) {
  try {
    const alertId = alert.id;
    const timeStr = new Date().toLocaleTimeString();
    
    // Append global email recipients from administrator settings
    const globalSettings = await db.getSettings('global');
    let extraRecipients = [];
    if (globalSettings && globalSettings.globalEmergencyEmails) {
      const emailList = globalSettings.globalEmergencyEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);
      extraRecipients = emailList.map((email, idx) => ({
        id: `global-recipient-${idx}`,
        name: `Global Emergency Responder`,
        email: email
      }));
    }

    const emailRecipients = [
      ...contacts.filter(c => c.email),
      ...extraRecipients
    ];

    if (emailRecipients.length === 0) return;

    for (const contact of emailRecipients) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden; background-color: #fafafa;">
          <div style="background-color: #10b981; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">✅ SilentSOS ALERT CANCELLED ✅</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px;">User <strong>${user.name}</strong> is safe and has cancelled the distress alert.</p>
          </div>
          
          <div style="padding: 24px; color: #333333; background-color: #ffffff;">
            <p style="font-size: 16px; margin-top: 0;">Dear ${contact.name},</p>
            <p style="font-size: 14px; line-height: 1.6;">
              This is a follow-up notification from SilentSOS. User <strong>${user.name}</strong> has successfully cancelled the active emergency alert with their safety PIN at <strong>${timeStr}</strong>.
            </p>
            
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: bold;">STATUS UPDATE:</p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #064e3b;">
                <li><strong>Distress Type:</strong> ${alert.type || 'General Distress'}</li>
                <li><strong>Current Status:</strong> <span style="background-color:#d1fae5; color:#065f46; padding: 2px 6px; border-radius: 4px; font-weight:bold;">Cancelled (User is Safe)</span></li>
                <li><strong>Resolved Time:</strong> ${timeStr}</li>
              </ul>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; line-height: 1.5; border-top: 1px solid #e1e1e1; padding-top: 15px;">
              No further emergency action is required. You can still review the recorded evidence and GPS trajectory at the broadcast link.
            </p>
          </div>
          <div style="background-color: #f3f4f6; color: #6b7280; padding: 16px; text-align: center; font-size: 11px; border-top: 1px solid #e1e1e1;">
            This email was dispatched automatically by SilentSOS safety systems via Resend.<br/>
            Ref Alert ID: ${alertId}
          </div>
        </div>
      `;

      const subject = `✅ SilentSOS RESOLVED: Emergency alert cancelled by ${user.name} (User is safe)`;

      await sendEmailViaResend({
        to: contact.email,
        subject: subject,
        html: htmlContent
      });
    }
  } catch (err) {
    console.error('❌ Failed to send cancel emails:', err);
  }
}

// Sends resolution email to contacts and responders when an alert is resolved/cleared
async function sendResolvedEmail(user, contacts, alert, resolutionSource = 'user') {
  try {
    const alertId = alert.id;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const userName = (user && user.name) || 'SilentSOS User';

    // Retrieve global email recipients from administrator settings
    const globalSettings = await db.getSettings('global');
    let extraRecipients = [];
    if (globalSettings && globalSettings.globalEmergencyEmails) {
      const emailList = globalSettings.globalEmergencyEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);
      extraRecipients = emailList.map((email, idx) => ({
        id: `global-recipient-${idx}`,
        name: `Global Emergency Dispatch`,
        email: email
      }));
    }

    // Merge contacts, global responders, and user's own email (if available)
    const emailRecipients = [
      ...contacts.filter(c => c && c.email),
      ...extraRecipients
    ];

    if (user && user.email && !emailRecipients.some(r => r.email.toLowerCase() === user.email.toLowerCase())) {
      emailRecipients.push({
        id: `user-${user.id}`,
        name: user.name,
        email: user.email
      });
    }

    if (emailRecipients.length === 0) {
      console.log(`ℹ️ No email recipients found for resolved alert ${alertId}`);
      return;
    }

    const latestGps = alert.gpsPath && alert.gpsPath.length > 0 ? alert.gpsPath[alert.gpsPath.length - 1] : null;
    const googleMapsLink = latestGps ? `https://www.google.com/maps?q=${latestGps.lat},${latestGps.lng}` : '';
    const broadcastLink = `${getAppBaseUrl()}/receiver/${alertId}`;
    const duration = alert.durationSeconds || Math.max(1, Math.round((Date.now() - (alert.timestamp || Date.now())) / 1000));
    const authorityLabel = resolutionSource === 'admin' ? 'Emergency Dispatch Operations Center (Admin)' : 'User Verified with Safety PIN (Confirmed Safe)';

    for (const recipient of emailRecipients) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 28px 24px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
              Incident Resolved &bull; All Clear
            </div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">✅ EMERGENCY RESOLVED</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.95;">User <strong>${userName}</strong> is safe. All active distress broadcasts have ceased.</p>
          </div>
          
          <!-- Content Body -->
          <div style="padding: 28px 24px; color: #1e293b; background-color: #ffffff;">
            <p style="font-size: 15px; margin-top: 0; color: #0f172a;">Dear <strong>${recipient.name || 'Emergency Responder'}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              This is an official resolution notice from <strong>SilentSOS</strong>. The emergency distress incident previously triggered by <strong>${userName}</strong> has been officially <strong>resolved and cleared</strong>.
            </p>
            
            <!-- Resolution Status Card -->
            <div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #bbf7d0; padding-bottom: 10px; margin-bottom: 12px;">
                <span style="color: #166534; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Incident Audit Report</span>
                <span style="background-color: #22c55e; color: white; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 800;">
                  RESOLVED &bull; ALL CLEAR
                </span>
              </div>
              
              <table style="width: 100%; font-size: 13px; line-height: 1.8; color: #166534;">
                <tr>
                  <td style="width: 150px; font-weight: bold; color: #14532d;">Distress Type:</td>
                  <td><strong>${alert.type || 'SOS Emergency Alert'}</strong></td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #14532d;">Resolution Authority:</td>
                  <td>${authorityLabel}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #14532d;">Resolved At:</td>
                  <td>${dateStr} at ${timeStr}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #14532d;">Total Duration:</td>
                  <td>${duration} seconds</td>
                </tr>
                ${latestGps ? `
                <tr>
                  <td style="font-weight: bold; color: #14532d;">Final GPS Location:</td>
                  <td>${latestGps.lat.toFixed(5)}, ${latestGps.lng.toFixed(5)} &bull; <a href="${googleMapsLink}" style="color: #059669; font-weight: bold; text-decoration: underline;">View on Google Maps</a></td>
                </tr>` : ''}
              </table>
            </div>

            <!-- Call to action button -->
            <div style="text-align: center; margin: 24px 0 16px 0;">
              <a href="${broadcastLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 10px; display: inline-block; font-size: 13px; box-shadow: 0 4px 10px rgba(5,150,105,0.25);">
                📂 View Incident Audit Trail & Captured Evidence
              </a>
            </div>
            
            <p style="font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 20px;">
              <strong>Notice to Responders:</strong> No further emergency intervention or dispatch is required for this incident. If you have any questions or require additional incident records, please consult the secure audit link above.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; color: #94a3b8; padding: 16px; text-align: center; font-size: 11px; border-top: 1px solid #e2e8f0; line-height: 1.5;">
            Dispatched securely by SilentSOS Emergency Safety Network via Resend.<br/>
            Incident Reference ID: <code style="font-family: monospace; color: #64748b;">${alertId}</code>
          </div>
        </div>
      `;

      const subject = `✅ SilentSOS RESOLVED: Emergency alert cleared for ${userName} (User is safe)`;

      await sendEmailViaResend({
        to: recipient.email,
        subject: subject,
        html: htmlContent
      });
      console.log(`✉️ Resolution email dispatched to ${recipient.email} for alert ${alertId}`);
    }
  } catch (err) {
    console.error('❌ Failed to dispatch alert resolution emails:', err);
  }
}

const emailDebounceTimers = new Map();

function scheduleEvidenceEmail(userId, alertId) {
  if (emailDebounceTimers.has(alertId)) {
    clearTimeout(emailDebounceTimers.get(alertId));
  }

  const timer = setTimeout(async () => {
    emailDebounceTimers.delete(alertId);
    
    try {
      const user = await db.getUser(userId);
      let contacts = await db.getContacts(userId);
      if (contacts.length === 0) {
        contacts = [
          { id: 'police-dispatch', name: 'Emergency Police Dispatch', phone: '911', email: 'dispatch@emergency.gov', preferences: { gps: true, photos: true, video: true, audio: true, message: true } },
          { id: 'trusted-responders', name: 'Trusted Emergency Responders', phone: '+15550199', email: 'responders@silentsos.org', preferences: { gps: true, photos: true, video: true, audio: true, message: true } }
        ];
      }

      let alert = activeAlert && activeAlert.id === alertId ? activeAlert : null;
      if (!alert) {
        const allHistory = await db.getAllHistory();
        alert = allHistory.find(e => e.id === alertId) || null;
      }

      if (user && alert) {
        console.log(`✉️ Triggering debounced evidence email for alert: ${alertId}`);
        await sendAlertEmails(user, contacts, alert, false);
      }
    } catch (err) {
      console.error('Failed to send debounced evidence email:', err);
    }
  }, 4000); // 4 seconds debounce

  emailDebounceTimers.set(alertId, timer);
}

// Dispatches 15-minute periodic email updates with real-time location, photos, videos, and microphone audio while alert is uncancelled
async function sendPeriodicAlertEmail(alertId, customLocation = null) {
  try {
    let alert = (activeAlert && activeAlert.id === alertId) ? activeAlert : null;
    if (!alert) {
      const allHistory = await db.getAllHistory();
      alert = allHistory.find(e => e.id === alertId) || null;
    }

    if (!alert) {
      console.warn(`⚠️ [15-Min Update] Alert ${alertId} not found.`);
      return false;
    }

    // STRICT CHECK: Alert must NOT be cancelled and must be STILL ACTIVE
    if (alert.status !== 'Active') {
      console.log(`ℹ️ [15-Min Update] Alert ${alertId} is no longer active (status: '${alert.status}'). Skipping dispatch.`);
      clearAlertTimersAndIntervals(alertId);
      return false;
    }

    // Debounce throttle check (at least 30 seconds between dispatches)
    const lastSent = lastPeriodicEmailTime.get(alertId) || 0;
    if (Date.now() - lastSent < 30000) {
      console.log(`ℹ️ [15-Min Update] Alert ${alertId} periodic email dispatched recently. Throttled.`);
      return false;
    }

    // Update GPS coordinates if new location supplied
    if (customLocation && typeof customLocation.lat === 'number' && typeof customLocation.lng === 'number') {
      const newPt = {
        lat: customLocation.lat,
        lng: customLocation.lng,
        timestamp: Date.now()
      };
      if (!alert.gpsPath) alert.gpsPath = [];
      alert.gpsPath.push(newPt);
      await db.updateHistoryEvent(alertId, { gpsPath: alert.gpsPath });

      try {
        const gpsFilePath = path.join(EVIDENCE_DIR, `gps_path_${alert.id}.json`);
        fs.writeFileSync(gpsFilePath, JSON.stringify(alert.gpsPath, null, 2));
      } catch (err) {
        console.warn('Could not write updated GPS path:', err.message);
      }

      broadcastToReceivers(alertId, {
        type: 'gps_update',
        gpsPoint: newPt
      });
    }

    const user = await db.getUser(alert.userId);
    let contacts = await db.getContacts(alert.userId);
    if (!contacts || contacts.length === 0) {
      contacts = [
        { id: 'police-dispatch', name: 'Emergency Police Dispatch', phone: '911', email: 'dispatch@emergency.gov', preferences: { gps: true, photos: true, video: true, audio: true, message: true } },
        { id: 'trusted-responders', name: 'Trusted Emergency Responders', phone: '+15550199', email: 'responders@silentsos.org', preferences: { gps: true, photos: true, video: true, audio: true, message: true } }
      ];
    }

    // Retrieve global email recipients from administrator settings
    const globalSettings = await db.getSettings('global');
    let extraRecipients = [];
    if (globalSettings && globalSettings.globalEmergencyEmails) {
      const emailList = globalSettings.globalEmergencyEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);
      extraRecipients = emailList.map((email, idx) => ({
        id: `global-recipient-${idx}`,
        name: `Global Emergency Responder`,
        email: email,
        preferences: { gps: true, photos: true, video: true, audio: true, message: true }
      }));
    }

    const emailRecipients = [
      ...contacts.filter(c => c && c.email),
      ...extraRecipients
    ];

    if (emailRecipients.length === 0) {
      console.log(`ℹ️ [15-Min Update] No recipients with email for alert ${alertId}.`);
      return false;
    }

    const latestCoords = alert.gpsPath && alert.gpsPath.length > 0
      ? alert.gpsPath[alert.gpsPath.length - 1]
      : { lat: 0, lng: 0 };

    const elapsedMs = Date.now() - (alert.timestamp || Date.now());
    const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const updateTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const updateDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const broadcastLink = `${getAppBaseUrl()}/receiver/${alertId}`;
    const googleMapsLink = `https://maps.google.com/?q=${latestCoords.lat},${latestCoords.lng}`;

    // Collect attachments from evidence files (photos, audio recordings, video clips)
    const attachments = [];
    const evidenceListHtml = [];

    if (alert.evidence && Array.isArray(alert.evidence.files) && alert.evidence.files.length > 0) {
      // Sort newest files first
      const sortedFiles = [...alert.evidence.files].reverse();
      let totalSize = 0;
      const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10MB limit

      sortedFiles.forEach((file, idx) => {
        const filePath = path.join(EVIDENCE_DIR, path.basename(file.url));
        const fileUrl = `${getMediaBaseUrl()}${file.url}`;
        const fileTypeLabel = (file.type || 'media').toUpperCase();

        evidenceListHtml.push(`
          <li style="margin-bottom: 6px;">
            <strong>${fileTypeLabel}:</strong> 
            <a href="${fileUrl}" style="color: #ef4444; font-weight: bold; text-decoration: underline;">
              Open / Download ${fileTypeLabel} Clip ${idx + 1}
            </a>
            <span style="color: #94a3b8; font-size: 11px;">(${new Date(file.timestamp || Date.now()).toLocaleTimeString()})</span>
          </li>
        `);

        if (fs.existsSync(filePath)) {
          try {
            const stats = fs.statSync(filePath);
            if (stats.size > 0 && (totalSize + stats.size) <= MAX_TOTAL_BYTES) {
              totalSize += stats.size;
              attachments.push({
                filename: `realtime_${file.type}_${idx + 1}${path.extname(file.url)}`,
                path: filePath
              });
            }
          } catch (e) {
            console.warn(`Could not read evidence file ${filePath}:`, e.message);
          }
        }
      });
    }

    // Attach latest GPS breadcrumbs JSON if available
    const gpsFilePath = path.join(EVIDENCE_DIR, `gps_path_${alert.id}.json`);
    if (fs.existsSync(gpsFilePath)) {
      attachments.push({
        filename: `realtime_gps_trail_${alert.id}.json`,
        path: gpsFilePath
      });
    }

    const userName = (user && user.name) || 'SilentSOS User';

    for (const contact of emailRecipients) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1.5px solid #f87171; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 6px 18px rgba(239,68,68,0.12);">
          <!-- Top Warning Header -->
          <div style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ea580c 100%); color: white; padding: 26px 22px; text-align: center;">
            <div style="display: inline-block; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.4); padding: 5px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;">
              ⚡ 15-MINUTE REAL-TIME STATUS UPDATE
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">🚨 ALERT STILL ACTIVE &amp; UNRESOLVED</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.95;">
              User <strong>${userName}</strong> is still in distress (${elapsedMinutes} minutes elapsed). Live location and evidence refreshed.
            </p>
          </div>
          
          <div style="padding: 24px 22px; color: #1e293b; background-color: #ffffff;">
            <p style="font-size: 15px; margin-top: 0; color: #0f172a;">
              Dear <strong>${contact.name || 'Emergency Responder'}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              This is an automated <strong>15-minute real-time update</strong> from <strong>SilentSOS Emergency Response Network</strong>. Because this alert has <strong>NOT been cancelled</strong> and remains <strong>STILL ACTIVE</strong>, we are dispatching updated real-time telemetry, GPS coordinates, surveillance photos, videos, and microphone audio recordings.
            </p>

            <!-- Real-time Location Card -->
            <div style="background-color: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ffe4e6; padding-bottom: 8px; margin-bottom: 12px;">
                <span style="color: #9f1239; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                  📍 REAL-TIME USER LOCATION TELEMETRY
                </span>
                <span style="background-color: #ef4444; color: white; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 800;">
                  LIVE GPS
                </span>
              </div>

              <table style="width: 100%; font-size: 13px; line-height: 1.8; color: #881337;">
                <tr>
                  <td style="width: 140px; font-weight: bold; color: #9f1239;">Current Coordinates:</td>
                  <td><strong>Latitude: ${latestCoords.lat.toFixed(6)}, Longitude: ${latestCoords.lng.toFixed(6)}</strong></td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #9f1239;">Last Updated:</td>
                  <td>${updateDateStr} at ${updateTimeStr}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #9f1239;">Active Duration:</td>
                  <td><strong>${elapsedMinutes} minutes</strong> (Alert is ongoing)</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #9f1239;">Recorded Path:</td>
                  <td>${(alert.gpsPath && alert.gpsPath.length) || 1} breadcrumb points logged</td>
                </tr>
              </table>

              <div style="margin-top: 14px; text-align: center;">
                <a href="${googleMapsLink}" style="background-color: #ef4444; color: white; padding: 10px 18px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 13px; margin-right: 8px; margin-bottom: 6px;">
                  📍 Open Live GPS in Google Maps
                </a>
                <a href="${broadcastLink}" style="background-color: #0f172a; color: white; padding: 10px 18px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 13px; margin-bottom: 6px;">
                  🛰️ Open Responder Live Dashboard
                </a>
              </div>
            </div>

            <!-- Emergency Medical & Profile Details -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                👤 EMERGENCY USER PROFILE &amp; RESCUE DATA:
              </h3>
              <table style="width: 100%; font-size: 13px; line-height: 1.6; border-collapse: collapse; color: #334155;">
                <tr><td style="padding: 4px 0; font-weight: bold; width: 140px; color: #64748b;">Full Legal Name:</td><td><strong>${userName}</strong></td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Phone Number:</td><td>${user?.phone ? `<strong>${user.phone}</strong>` : '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Medical Blood Group:</td><td>${user?.bloodGroup ? `<span style="background-color:#fee2e2; color:#991b1b; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${user.bloodGroup}</span>` : '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Home Address:</td><td>${user?.address || '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Next-of-Kin (Mother):</td><td>${user?.motherName || '<em>Not specified</em>'}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #64748b;">Next-of-Kin (Father):</td><td>${user?.fatherName || '<em>Not specified</em>'}</td></tr>
              </table>
            </div>

            <!-- Real-time Media Evidence Card -->
            <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
                <span style="color: #334155; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                  🔒 REAL-TIME SURVEILLANCE EVIDENCE (${attachments.length} FILES ENCLOSED)
                </span>
                <span style="background-color: #334155; color: white; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: bold;">
                  📸 ${alert.evidence?.photos || 0} Photos &bull; 🎤 ${alert.evidence?.audio || 0} Audio &bull; 🎥 ${alert.evidence?.videos || 0} Video
                </span>
              </div>

              ${evidenceListHtml.length > 0 ? `
                <ul style="padding-left: 20px; font-size: 13px; line-height: 1.6; color: #334155; margin: 0 0 12px 0;">
                  ${evidenceListHtml.slice(0, 10).join('')}
                </ul>
                <p style="font-size: 12px; color: #64748b; margin: 0;">
                  <em>📎 Fresh photos, video clips, and microphone sounds are attached directly to this email for immediate playback.</em>
                </p>
              ` : `
                <p style="font-size: 13px; color: #64748b; margin: 0; font-style: italic;">
                  Surveillance capture stream is active. New media clips will attach to subsequent 15-minute dispatches.
                </p>
              `}
            </div>

            <div style="background-color: #fef2f2; border: 1px dashed #f87171; border-radius: 10px; padding: 12px 16px; margin-top: 20px; font-size: 12px; color: #991b1b; line-height: 1.5;">
              ⏱️ <strong>Recurring 15-Minute Policy:</strong> If this emergency is not cancelled or resolved by the user, another updated real-time email package with updated GPS coordinates and fresh audio/video/photos will be automatically dispatched in <strong>15 minutes</strong>.
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; color: #94a3b8; padding: 16px; text-align: center; font-size: 11px; border-top: 1px solid #e2e8f0; line-height: 1.5;">
            SilentSOS Automated Emergency Monitoring System (Resend Powered)<br/>
            Alert Reference ID: <code style="font-family: monospace; color: #64748b;">${alertId}</code> &bull; Dispatched at: ${updateDateStr} ${updateTimeStr}
          </div>
        </div>
      `;

      const subject = `🚨 [15-MIN REAL-TIME UPDATE] SOS Alert Still Active: ${userName} (${elapsedMinutes}m elapsed)`;

      await sendEmailViaResend({
        to: contact.email,
        subject: subject,
        html: htmlContent,
        attachments: attachments
      });
      console.log(`✉️ [15-MIN UPDATE] Real-time email successfully dispatched to ${contact.email} for alert ${alertId}`);
    }

    lastPeriodicEmailTime.set(alertId, Date.now());
    return true;
  } catch (err) {
    console.error(`❌ Failed to send 15-minute periodic update email for alert ${alertId}:`, err);
    return false;
  }
}

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['*'] }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/evidence', express.static(EVIDENCE_DIR));

// Health check / root route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>SilentSOS Backend</title>
    <style>
      body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
      .card { background:#1e293b; border-radius:16px; padding:40px; text-align:center; max-width:400px; }
      h1 { color:#f472b6; margin-bottom:8px; } 
      .badge { background:#22c55e; color:#fff; border-radius:99px; padding:4px 16px; font-size:14px; display:inline-block; margin:12px 0; }
      p { color:#94a3b8; font-size:14px; }
    </style>
    </head>
    <body>
      <div class="card">
        <h1>🚨 SilentSOS</h1>
        <div class="badge">✓ Backend Online</div>
        <p>API is running and ready.</p>
        <p style="font-size:12px; margin-top:20px;">Frontend: <a href="http://localhost:5173" style="color:#f472b6;">http://localhost:5173</a></p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/debug/mail', (req, res) => {
  res.json({
    envHost: process.env.SMTP_HOST,
    envPort: process.env.SMTP_PORT,
    envUser: process.env.SMTP_USER,
    hasPass: !!process.env.SMTP_PASS,
    transporterInit: !!mailTransporter,
    transporterUser: mailTransporter?.options?.auth?.user,
    lastMailError
  });
});

app.get('/api/debug/db', async (req, res) => {
  try {
    const timeRes = await pool.query('SELECT NOW() as now, version() as version, current_database() as db_name');
    const tableRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
    res.json({
      status: 'connected',
      database: timeRes.rows[0].db_name,
      serverTime: timeRes.rows[0].now,
      version: timeRes.rows[0].version,
      tables: tableRes.rows.map(r => r.table_name)
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

// Simple JWT-like base64 Token Authentication middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    req.userId = decoded.userId;

    const user = await db.getUser(req.userId);
    if (user && user.disabled) {
      return res.status(403).json({ error: 'Your account has been disabled by an administrator.' });
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
}

// Optional token middleware: parses token if present, but doesn't block unauthenticated callers
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      req.userId = decoded.userId;
    } catch (err) {}
  }
  next();
}

// Admin role check middleware
async function requireAdmin(req, res, next) {
  const user = await db.getUser(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator access required.' });
  }
  next();
}

// In-memory active alert reference
let activeAlert = null;

// Track connected WebSocket clients
const wsClients = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        wsClients.set(ws, { role: data.role, alertId: data.alertId });
        console.log(`Registered WS client: ${data.role} for Alert ID: ${data.alertId}`);
        
        // Push initial alert package to receiver immediately
        if (data.role === 'receiver' && activeAlert && activeAlert.id === data.alertId) {
          ws.send(JSON.stringify({
            type: 'alert_update',
            alert: activeAlert
          }));
        }
      }

      if (data.type === 'gps_update') {
        const clientInfo = wsClients.get(ws);
        if (clientInfo && clientInfo.role === 'sender') {
          const { lat, lng, timestamp } = data;

          if (activeAlert && activeAlert.id === clientInfo.alertId) {
            const gpsPoint = { lat, lng, timestamp: timestamp || Date.now() };
            activeAlert.gpsPath.push(gpsPoint);
            
            // Sync with DB history (encrypts path inside db.js)
            db.updateHistoryEvent(activeAlert.id, { gpsPath: activeAlert.gpsPath });

            // Save GPS history as evidence file
            try {
              const gpsFilePath = path.join(EVIDENCE_DIR, `gps_path_${activeAlert.id}.json`);
              fs.writeFileSync(gpsFilePath, JSON.stringify(activeAlert.gpsPath, null, 2));
            } catch (err) {
              console.error('Failed to write GPS path to evidence file:', err);
            }

            // Broadcast updates
            broadcastToReceivers(activeAlert.id, {
              type: 'gps_update',
              gpsPoint
            });
          }
        }
      }
    } catch (e) {
      console.error('WebSocket parsing error:', e);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

function broadcastToReceivers(alertId, messageObj) {
  const messageStr = JSON.stringify(messageObj);
  for (const [ws, info] of wsClients.entries()) {
    if (info.role === 'receiver' && info.alertId === alertId && ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
}

// Simulated SMS, WhatsApp, Email notification generator
function dispatchEmergencyAlerts(user, contacts, alertId, lat = 19.076, lng = 72.8777) {
  const timeStr = new Date().toLocaleTimeString();
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const broadcastLink = `${getAppBaseUrl()}/receiver/${alertId}`;

  return contacts.map(c => {
    return {
      contactId: c.id,
      contactName: c.name,
      phone: c.phone,
      email: c.email,
      channels: {
        sms: {
          status: c.preferences.message ? 'Delivered' : 'Skipped',
          service: 'Twilio Emergency Gateway',
          payload: `🚨 SOS! ${c.name}, ${user.name} triggered a safety alert! Time: ${timeStr}. Live Map: ${broadcastLink} Location: ${mapsLink}`,
          timestamp: Date.now()
        },
        whatsapp: {
          status: c.preferences.message ? 'Delivered' : 'Skipped',
          service: 'Meta Cloud API v16.0',
          payload: `🚨 *SilentSOS EMERGENCY ALERT* 🚨\nUser *${user.name}* needs help.\n- Time: ${timeStr}\n- Live Map: ${broadcastLink}\n- Google Maps: ${mapsLink}`,
          timestamp: Date.now()
        },
        email: {
          status: c.preferences.email ? 'Delivered' : 'Skipped',
          service: 'SendGrid SMTP Transport',
          payload: `Dear ${c.name},\n\nThis is an automated emergency notification from SilentSOS. User ${user.name} has triggered an alert. Review live evidence and coordinate paths: ${broadcastLink}`,
          timestamp: Date.now()
        },
        push: {
          status: 'Delivered',
          service: 'Firebase Cloud Messaging (FCM)',
          payload: `EMERGENCY ALERT: ${user.name} needs help! Tap to view live location tracker.`,
          timestamp: Date.now()
        }
      }
    };
  });
}

// 🔓 PUBLIC ROUTE: Authorization (Login / Registration)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const user = await db.registerUser(email, password, name);
    const token = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.authenticateUser(email, password);
    if (user.disabled) {
      return res.status(403).json({ error: 'Your account has been disabled by an administrator.' });
    }
    const token = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔓 PUBLIC ROUTE: Forgot Password - Request 6-digit verification code sent to user email
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists in the database
    const user = await db.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address. Please check your spelling or register.' });
    }

    if (user.disabled) {
      return res.status(403).json({ error: 'This account has been disabled. Please contact an administrator.' });
    }

    // Generate secure 6-digit verification code & magic token
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save tokens in auth_tokens table
    await db.saveAuthToken(cleanEmail, resetCode, 'reset', expiresAt);

    const clientOrigin = getAppBaseUrl(req);
    const directResetLink = `${clientOrigin}/?resetEmail=${encodeURIComponent(cleanEmail)}&resetCode=${resetCode}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: white; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🚨 SilentSOS</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Password Reset Verification Code</p>
        </div>
        
        <div style="padding: 32px 28px; color: #1e293b;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Password Reset Request</h2>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Hello <strong>${user.name || 'there'}</strong>,<br/>
            We received a request to reset the password for your <strong>SilentSOS</strong> account. Use the 6-digit verification code below to authorize your password change:
          </p>

          <div style="background: #fff1f2; border: 2px dashed #f43f5e; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0;">
            <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #9f1239; letter-spacing: 1px;">Security Verification Code</span>
            <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #e11d48; margin: 12px 0; font-family: 'Courier New', monospace;">
              ${resetCode}
            </div>
            <span style="font-size: 12px; color: #e11d48; font-weight: 500;">⏱️ Valid for 10 minutes</span>
          </div>

          <div style="text-align: center; margin: 24px 0 20px 0;">
            <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Or reset directly with 1 click:</p>
            <a href="${directResetLink}" style="background-color: #e11d48; color: white; padding: 12px 26px; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25);">
              🔐 1-Click Reset Password
            </a>
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 24px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
            <p style="margin: 0;"><strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. Your current password will remain unchanged.</p>
          </div>
        </div>
        
        <div style="background: #f8fafc; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Dispatched securely by SilentSOS Identity Protection via Resend
        </div>
      </div>
    `;

    const sendResult = await sendEmailViaResend({
      to: cleanEmail,
      subject: `🔐 ${resetCode} is your SilentSOS Password Reset Verification Code`,
      html: htmlContent
    });

    console.log(`✉️ Password reset verification email dispatched to ${cleanEmail}. Forwarded: ${sendResult.forwarded}`);

    res.json({
      success: true,
      message: sendResult.forwarded
        ? `Verification code dispatched (Sandbox mode: forwarded to ${process.env.RESEND_SANDBOX_EMAIL || 'sheshadrihvr@gmail.com'})`
        : `Verification code sent to ${cleanEmail}`,
      email: cleanEmail,
      forwarded: sendResult.forwarded
    });
  } catch (err) {
    console.error('Failed to dispatch password reset email:', err);
    res.status(500).json({ error: 'Failed to send password reset verification email: ' + err.message });
  }
});

// 🔓 PUBLIC ROUTE: Verify code and set new password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, password, token, code } = req.body;
  const verificationCode = token || code;
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and new password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();

    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code is required to reset your password.' });
    }

    const isValid = await db.verifyAuthToken(cleanEmail, verificationCode);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
    }

    await db.resetPassword(cleanEmail, password);
    res.json({ success: true, message: 'Password reset successful! You can now log in.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔓 PUBLIC ROUTE: Resend Token Authentication - Request 6-digit OTP code / Magic Link
app.post('/api/auth/send-token', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Also generate magic link token
    const magicToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save tokens in database
    await db.saveAuthToken(cleanEmail, otpCode, 'otp', expiresAt);
    await db.saveAuthToken(cleanEmail, magicToken, 'magic', expiresAt);

    const magicLink = `${getAppBaseUrl(req)}/?authEmail=${encodeURIComponent(cleanEmail)}&authToken=${magicToken}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🚨 SilentSOS</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Secure Token Authentication Gateway (Powered by Resend)</p>
        </div>
        
        <div style="padding: 32px 28px; color: #1e293b;">
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Your Authentication Security Token</h2>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            You requested sign-in to <strong>SilentSOS</strong>. Enter this 6-digit security token into the app:
          </p>

          <div style="background: #fef2f2; border: 2px dashed #fca5a5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 12px; text-transform: uppercase; font-weight: 700; color: #991b1b; letter-spacing: 1px;">Security Verification Code</span>
            <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #dc2626; margin: 12px 0; font-family: 'Courier New', monospace;">
              ${otpCode}
            </div>
            <span style="font-size: 12px; color: #ef4444; font-weight: 500;">⏱️ Valid for 10 minutes</span>
          </div>

          <div style="text-align: center; margin: 28px 0 20px 0;">
            <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Or sign in instantly with 1-click:</p>
            <a href="${magicLink}" style="background-color: #dc2626; color: white; padding: 13px 28px; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);">
              ⚡ 1-Click Secure Sign In
            </a>
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
            <p style="margin: 0;"><strong>Security Notice:</strong> If you did not request this security code, ignore this email. Never disclose this code to anyone.</p>
          </div>
        </div>
        
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Dispatched securely by SilentSOS Safety Infrastructure via Resend API
        </div>
      </div>
    `;

    const sendResult = await sendEmailViaResend({
      to: cleanEmail,
      subject: `🔑 ${otpCode} is your SilentSOS security authentication token`,
      html: htmlContent
    });

    console.log(`✉️ Token auth email dispatched to ${cleanEmail} via Resend. Forwarded: ${sendResult.forwarded}`);

    res.json({
      success: true,
      message: sendResult.forwarded
        ? `Security token dispatched via Resend (Forwarded to ${process.env.RESEND_SANDBOX_EMAIL || 'sheshadrihvr@gmail.com'} in sandbox mode)`
        : `Security token sent successfully to ${cleanEmail}`,
      email: cleanEmail,
      forwarded: sendResult.forwarded
    });
  } catch (err) {
    console.error('Failed to dispatch token authentication email:', err);
    res.status(500).json({ error: 'Failed to dispatch security token: ' + err.message });
  }
});

// 🔓 PUBLIC ROUTE: Resend Token Authentication - Verify 6-digit OTP code / Magic Link
app.post('/api/auth/verify-token', async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: 'Email and verification token are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    const isValid = await db.verifyAuthToken(cleanEmail, cleanToken);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired security code. Please request a new token.' });
    }

    // Token is valid! Retrieve or auto-register user
    let user = await db.getUserByEmail(cleanEmail);
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const defaultName = cleanEmail.split('@')[0];
      user = await db.registerUser(cleanEmail, randomPassword, defaultName);
      console.log(`👤 New user auto-registered via email token: ${cleanEmail}`);
    }

    if (user.disabled) {
      return res.status(403).json({ error: 'Your account has been disabled by an administrator.' });
    }

    const sessionToken = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');
    console.log(`✅ User ${user.email} successfully logged in via Resend Token Authentication!`);
    res.json({ token: sessionToken, user });
  } catch (err) {
    console.error('Failed to verify security token:', err);
    res.status(500).json({ error: 'Failed to verify token: ' + err.message });
  }
});

// 🔓 PUBLIC / TEST ROUTE: Test Resend Alert Notification Dispatch
app.post('/api/alerts/test-resend', async (req, res) => {
  try {
    const targetEmail = req.body.email || process.env.RESEND_SANDBOX_EMAIL || 'sheshadrihvr@gmail.com';
    const testAlert = {
      id: 'test-' + Date.now(),
      timestamp: Date.now(),
      type: 'SOS Test Notification',
      durationSeconds: 0,
      status: 'Active Test',
      evidence: { photos: 1, videos: 0, audio: 0, files: [] },
      gpsPath: [{ lat: 17.448293, lng: 78.391485, timestamp: Date.now() }]
    };

    const testUser = {
      name: 'SilentSOS Live User',
      email: targetEmail,
      phone: '+91 9876543210',
      bloodGroup: 'O+',
      address: 'Madhapur, Hitech City, Hyderabad, Telangana',
      motherName: 'Mother',
      fatherName: 'Father'
    };

    const result = await sendEmailViaResend({
      to: targetEmail,
      subject: `🚨 [TEST ALERT] SilentSOS Emergency Dispatch via Resend`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden; background-color: #fafafa;">
          <div style="background-color: #ef4444; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">🚨 SilentSOS TEST ALERT DISPATCH 🚨</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px;">Resend API Key Connection Verified</p>
          </div>
          <div style="padding: 24px; color: #333333; background-color: #ffffff;">
            <p style="font-size: 15px; margin-top: 0;">This is an automated test confirming that your <strong>Resend API Key</strong> is successfully active for <strong>Token Authentication</strong> and <strong>All Alert Notifications</strong>.</p>
            
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0; color: #166534; font-size: 13px; line-height: 1.6;">
              <strong style="font-size: 14px;">✅ Resend Integration Status:</strong><br/>
              • <strong>Resend API Key:</strong> Authenticated & Connected<br/>
              • <strong>Token Authentication:</strong> Active (OTP & 1-Click Login)<br/>
              • <strong>Initial SOS Alerts:</strong> Enabled (with GPS & Emergency Profile)<br/>
              • <strong>Evidence Updates:</strong> Enabled (Photos & Audio enclosures)<br/>
              • <strong>Alert Cancellation:</strong> Enabled (Safe PIN confirmation)
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
              <strong style="font-size: 12px; color: #64748b; text-transform: uppercase;">Sample Emergency Profile Enclosed:</strong>
              <div style="font-size: 13px; color: #334155; margin-top: 6px;">
                User: <strong>${testUser.name}</strong> | Phone: <strong>${testUser.phone}</strong> | Blood Group: <span style="background-color:#fee2e2; color:#991b1b; padding:1px 6px; border-radius:4px; font-weight:bold;">${testUser.bloodGroup}</span><br/>
                Address: ${testUser.address}
              </div>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">SilentSOS safety responders and emergency contacts receive real-time notifications instantly whenever distress is triggered.</p>
          </div>
          <div style="background-color: #f3f4f6; color: #6b7280; padding: 14px; text-align: center; font-size: 11px; border-top: 1px solid #e1e1e1;">
            SilentSOS Emergency Response Network • Dispatched via Resend
          </div>
        </div>
      `
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔓 PUBLIC ROUTE: Receiver specific alert details
app.get('/api/alerts/:id', async (req, res) => {
  const alertId = req.params.id;

  // First check in-memory active alert
  if (activeAlert && activeAlert.id === alertId) {
    return res.json(activeAlert);
  }

  // Search all users' history using the DB helper which handles decryption
  const dbState = await db.getAllHistory();
  const decryptedAlert = dbState.find(e => e.id === alertId);
  if (decryptedAlert) {
    return res.json(decryptedAlert);
  }

  res.status(404).json({ error: 'Alert not found' });
});

// 🔓 PUBLIC ROUTE: Upload media evidence (alertId is the shared secret)
app.post('/api/alerts/:id/evidence', upload.fields([
  { name: 'photo', maxCount: 10 },
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  const alertId = req.params.id;

  // Always prefer the live activeAlert reference so in-memory mutations stick
  const isActive = activeAlert && activeAlert.id === alertId;
  let alert = isActive ? activeAlert : null;

  if (!alert) {
    const allHistory = await db.getAllHistory();
    alert = allHistory.find(e => e.id === alertId) || null;
  }

  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  if (!alert.evidence) alert.evidence = { photos: 0, videos: 0, audio: 0, files: [] };
  if (!alert.evidence.files) alert.evidence.files = [];

  const files = req.files;
  const fileUrls = [];

  if (files) {
    Object.keys(files).forEach(fieldName => {
      files[fieldName].forEach(file => {
        const fileUrl = `/evidence/${file.filename}`;
        const entry = { type: fieldName, url: fileUrl, timestamp: Date.now() };
        fileUrls.push(entry);
        if (fieldName === 'photo') alert.evidence.photos += 1;
        if (fieldName === 'video') alert.evidence.videos += 1;
        if (fieldName === 'audio') alert.evidence.audio  += 1;
        console.log(`📁 Evidence saved: ${file.filename} (${fieldName}) for alert ${alertId}`);
      });
    });
  }

  alert.evidence.files.push(...fileUrls);
  await db.updateHistoryEvent(alertId, { evidence: alert.evidence });
  broadcastToReceivers(alertId, { type: 'evidence_update', evidence: alert.evidence });

  // Schedule email dispatch with new evidence
  scheduleEvidenceEmail(alert.userId, alertId);

  res.json({ success: true, evidence: alert.evidence });
});

// Feedback submission accepts both authenticated users and guests
app.post('/api/feedback', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = userId ? await db.getUser(userId) : null;

    const { rating, category, message, deviceInfo } = req.body;
    const providedName = req.body.userName || req.body.name;
    const providedEmail = req.body.userEmail || req.body.email;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter your feedback message.' });
    }

    const resolvedName = (user && user.name) || providedName || 'App User';
    const resolvedEmail = (user && user.email) || providedEmail || '';

    const feedback = await db.addFeedback({
      userId: userId || null,
      userName: resolvedName,
      userEmail: resolvedEmail,
      rating: rating ? Number(rating) : 5,
      category: category || 'General Feedback',
      message: message.trim(),
      deviceInfo: deviceInfo || {}
    });

    // Notify administrator via Resend in the background
    try {
      const adminEmail = process.env.RESEND_SANDBOX_EMAIL || 'sheshadrihvr@gmail.com';
      const stars = '★'.repeat(feedback.rating) + '☆'.repeat(Math.max(0, 5 - feedback.rating));
      
      sendEmailViaResend({
        to: adminEmail,
        subject: `💬 [SilentSOS Feedback] ${feedback.category} (${feedback.rating}/5★) from ${resolvedName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden; background-color: #fafafa;">
            <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center; border-bottom: 3px solid #ec4899;">
              <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #f472b6;">💬 New SilentSOS App Feedback</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Submitted from Settings Screen</p>
            </div>
            
            <div style="padding: 24px; color: #333333; background-color: #ffffff;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <span style="background-color: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: bold;">
                  ${feedback.category}
                </span>
                <span style="font-size: 16px; color: #eab308; font-weight: bold;">
                  ${stars} (${feedback.rating}/5)
                </span>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
                  ${feedback.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </p>
              </div>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #475569; margin-top: 16px; line-height: 1.6;">
                <strong>Submitted by:</strong> ${resolvedName} (${resolvedEmail || 'No email provided'})<br/>
                <strong>Timestamp:</strong> ${new Date(feedback.createdAt).toLocaleString()}<br/>
                <strong>Feedback ID:</strong> <code>${feedback.id}</code>
              </div>
            </div>
            
            <div style="background-color: #f8fafc; color: #94a3b8; padding: 12px; text-align: center; font-size: 11px; border-top: 1px solid #e2e8f0;">
              SilentSOS Quality Assurance & User Voice System
            </div>
          </div>
        `
      }).catch(mailErr => console.warn('Could not forward feedback email:', mailErr.message));
    } catch (e) {
      console.warn('Feedback email notification skipped:', e.message);
    }

    res.json({ success: true, feedback });
  } catch (err) {
    console.error('Error recording feedback:', err);
    res.status(500).json({ error: 'Failed to record feedback: ' + err.message });
  }
});

// 🔒 PROTECTED ROUTES: Require token authorization header
app.use('/api', authenticateToken);

app.get('/api/state', async (req, res) => {
  const userId = req.userId;
  const user = await db.getUser(userId);
  const contacts = await db.getContacts(userId);
  const settings = await db.getSettings(userId);
  const history = await db.getHistory(userId);

  res.json({
    user,
    contacts,
    settings,
    history,
    activeAlert: activeAlert && activeAlert.userId === userId ? {
      isActive: true,
      isCountingDown: false,
      startTime: activeAlert.timestamp,
      type: activeAlert.type,
      id: activeAlert.id
    } : null
  });
});

app.post('/api/user/setup-complete', async (req, res) => {
  const user = await db.updateUserProfile(req.userId, { isSetupComplete: true });
  res.json(user);
});

app.post('/api/user', async (req, res) => {
  try {
    const { name, email, phone, profileImage, bloodGroup, address, motherName, fatherName, password } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined && email.trim() !== '') updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (bloodGroup !== undefined) updates.bloodGroup = bloodGroup;
    if (address !== undefined) updates.address = address;
    if (motherName !== undefined) updates.motherName = motherName;
    if (fatherName !== undefined) updates.fatherName = fatherName;
    if (password !== undefined && password.trim() !== '') {
      updates.password = password;
    }
    const user = await db.updateUserProfile(req.userId, updates);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/user', async (req, res) => {
  try {
    const { name, email, phone, profileImage, bloodGroup, address, motherName, fatherName, password } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined && email.trim() !== '') updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (bloodGroup !== undefined) updates.bloodGroup = bloodGroup;
    if (address !== undefined) updates.address = address;
    if (motherName !== undefined) updates.motherName = motherName;
    if (fatherName !== undefined) updates.fatherName = fatherName;
    if (password !== undefined && password.trim() !== '') {
      updates.password = password;
    }
    const user = await db.updateUserProfile(req.userId, updates);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/contacts', async (req, res) => {
  res.json(await db.getContacts(req.userId));
});

app.post('/api/contacts', async (req, res) => {
  const contacts = await db.addContact(req.userId, req.body);
  res.json(contacts);
});

app.put('/api/contacts/:id', async (req, res) => {
  const contacts = await db.updateContact(req.userId, req.params.id, req.body);
  res.json(contacts);
});

app.delete('/api/contacts/:id', async (req, res) => {
  const contacts = await db.removeContact(req.userId, req.params.id);
  res.json(contacts);
});

app.get('/api/settings', async (req, res) => {
  res.json(await db.getSettings(req.userId));
});

app.put('/api/settings', async (req, res) => {
  const settings = await db.updateSettings(req.userId, req.body);
  res.json(settings);
});

// Feedback user history route

app.get('/api/feedback', async (req, res) => {
  try {
    const feedbackList = await db.getUserFeedback(req.userId);
    res.json(feedbackList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  res.json(await db.getHistory(req.userId));
});

// Trigger a new alert
app.post('/api/alerts', async (req, res) => {
  const userId = req.userId;
  const user = await db.getUser(userId);
  let contacts = await db.getContacts(userId);

  // Fallback to default responders if user has no contacts configured
  if (contacts.length === 0) {
    contacts = [
      { id: 'police-dispatch', name: 'Emergency Police Dispatch', phone: '911', email: 'dispatch@emergency.gov', preferences: { gps: true, photos: true, video: true, audio: true, message: true } },
      { id: 'trusted-responders', name: 'Trusted Emergency Responders', phone: '+15550199', email: 'responders@silentsos.org', preferences: { gps: true, photos: true, video: true, audio: true, message: true } }
    ];
  }

  const { type, location } = req.body;

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return res.status(400).json({ error: 'Location access is required to trigger an SOS alert. Please ensure location services are enabled.' });
  }

  const id = Date.now().toString();
  const initialLat = location.lat;
  const initialLng = location.lng;

  // Generate notification dispatch logs
  const dispatchLogs = dispatchEmergencyAlerts(user, contacts, id, initialLat, initialLng);

  const newAlert = {
    id,
    userId,
    timestamp: Date.now(),
    type: type || 'General',
    durationSeconds: 0,
    status: 'Active',
    evidence: {
      photos: 0,
      videos: 0,
      audio: 0,
      files: []
    },
    contactsNotified: dispatchLogs,
    gpsPath: [{
      lat: initialLat,
      lng: initialLng,
      timestamp: Date.now()
    }]
  };

  activeAlert = newAlert;
  
  // Save event
  await db.addHistoryEvent(userId, newAlert);

  console.log(`SOS active for user ${user.name}. Alert ID: ${id}`);
  
  // Automatically dispatch emergency alert notification email (immediate, Email 1)
  sendAlertEmails(user, contacts, newAlert, true);

  // Schedule Email 2: Send evidence files exactly 20 seconds after trigger
  const alertId = id;
  const timer = setTimeout(async () => {
    activeAlertTimers.delete(alertId);
    if (!sentEvidenceAlerts.has(alertId)) {
      sentEvidenceAlerts.add(alertId);
      try {
        let alert = (activeAlert && activeAlert.id === alertId) ? activeAlert : null;
        if (!alert) {
          const allHistory = await db.getAllHistory();
          alert = allHistory.find(e => e.id === alertId) || null;
        }
        if (alert) {
          console.log(`✉️ 20-second timer fired! Automatically dispatching evidence email for alert: ${alertId}`);
          await sendAlertEmails(user, contacts, alert, false);
        }
      } catch (err) {
        console.error('Failed to send 20-second scheduled evidence email:', err);
      }
    }
  }, 20000);
  activeAlertTimers.set(alertId, timer);

  // Schedule recurring 15-minute real-time location & surveillance updates while alert is active
  const UPDATE_INTERVAL_MS = parseInt(process.env.ALERT_UPDATE_INTERVAL_MS || '900000', 10); // 15 mins (900,000 ms)
  const periodicInterval = setInterval(async () => {
    try {
      let alert = (activeAlert && activeAlert.id === alertId) ? activeAlert : null;
      if (!alert) {
        const allHistory = await db.getAllHistory();
        alert = allHistory.find(e => e.id === alertId) || null;
      }

      if (!alert || alert.status !== 'Active') {
        console.log(`⏰ [15-MIN INTERVAL] Alert ${alertId} is no longer active (status: ${alert?.status || 'missing'}). Clearing interval.`);
        clearAlertTimersAndIntervals(alertId);
        return;
      }

      console.log(`⏰ [15-MIN CRON] Alert ${alertId} is STILL ACTIVE! Automatically dispatching 15-minute real-time update email...`);
      await sendPeriodicAlertEmail(alertId);
    } catch (err) {
      console.error(`❌ [15-MIN CRON] Error dispatching periodic update email for alert ${alertId}:`, err);
    }
  }, UPDATE_INTERVAL_MS);

  activeAlertIntervals.set(alertId, periodicInterval);

  res.json(newAlert);
});

// Trigger 15-minute periodic update with freshly captured evidence & location
app.post('/api/alerts/:id/periodic-update', async (req, res) => {
  const alertId = req.params.id;
  const { location } = req.body || {};
  try {
    const dispatched = await sendPeriodicAlertEmail(alertId, location);
    res.json({ success: true, dispatched });
  } catch (err) {
    console.error(`Failed to handle periodic-update for alert ${alertId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Upload media evidence
app.post('/api/alerts/:id/evidence', upload.fields([
  { name: 'photo', maxCount: 10 },
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  const alertId = req.params.id;

  // Always prefer the live activeAlert reference so in-memory mutations stick
  const isActive = activeAlert && activeAlert.id === alertId;
  let alert = isActive ? activeAlert : null;

  if (!alert) {
    // Fallback: look up in persisted history
    const allHistory = await db.getAllHistory();
    alert = allHistory.find(e => e.id === alertId) || null;
  }

  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  // Ensure evidence structure exists
  if (!alert.evidence) alert.evidence = { photos: 0, videos: 0, audio: 0, files: [] };
  if (!alert.evidence.files) alert.evidence.files = [];

  const files = req.files;
  const fileUrls = [];

  if (files) {
    Object.keys(files).forEach(fieldName => {
      files[fieldName].forEach(file => {
        const fileUrl = `/evidence/${file.filename}`;
        const entry = { type: fieldName, url: fileUrl, timestamp: Date.now() };
        fileUrls.push(entry);

        if (fieldName === 'photo') alert.evidence.photos += 1;
        if (fieldName === 'video') alert.evidence.videos += 1;
        if (fieldName === 'audio') alert.evidence.audio  += 1;

        console.log(`📁 Evidence saved: ${file.filename} (${fieldName}) for alert ${alertId}`);
      });
    });
  }

  alert.evidence.files.push(...fileUrls);

  // Persist to DB
  await db.updateHistoryEvent(alertId, { evidence: alert.evidence });

  // Broadcast to live receiver dashboards
  broadcastToReceivers(alertId, {
    type: 'evidence_update',
    evidence: alert.evidence
  });

  // Schedule email dispatch with new evidence
  scheduleEvidenceEmail(alert.userId, alertId);

  res.json({ success: true, evidence: alert.evidence });
});

// Complete active alert capturing and dispatch immediate email
app.post('/api/alerts/:id/complete', async (req, res) => {
  const alertId = req.params.id;

  // Clear any pending debounce timer
  if (emailDebounceTimers.has(alertId)) {
    clearTimeout(emailDebounceTimers.get(alertId));
    emailDebounceTimers.delete(alertId);
  }

  // Clear the 20-second scheduled timer if active
  if (activeAlertTimers.has(alertId)) {
    clearTimeout(activeAlertTimers.get(alertId));
    activeAlertTimers.delete(alertId);
  }

  try {
    let alert = (activeAlert && activeAlert.id === alertId) ? activeAlert : null;
    if (!alert) {
      const allHistory = await db.getAllHistory();
      alert = allHistory.find(e => e.id === alertId) || null;
    }

    if (alert) {
      if (!sentEvidenceAlerts.has(alertId)) {
        sentEvidenceAlerts.add(alertId);
        const user = await db.getUser(alert.userId);
        let contacts = await db.getContacts(alert.userId);
        if (contacts.length === 0) {
          contacts = [
            { id: 'police-dispatch', name: 'Emergency Police Dispatch', phone: '911', email: 'dispatch@emergency.gov', preferences: { gps: true, photos: true, video: true, audio: true, message: true } },
            { id: 'trusted-responders', name: 'Trusted Emergency Responders', phone: '+15550199', email: 'responders@silentsos.org', preferences: { gps: true, photos: true, video: true, audio: true, message: true } }
          ];
        }

        console.log(`✉️ Alert complete! Immediately dispatching evidence email for alert: ${alertId}`);
        await sendAlertEmails(user, contacts, alert, false);
      }
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Alert not found' });
  } catch (err) {
    console.error('Failed to send immediate evidence email:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stop active alert
app.post('/api/alerts/:id/stop', async (req, res) => {
  const alertId = req.params.id;

  // Clear any active scheduled timers and recurring intervals
  clearAlertTimersAndIntervals(alertId);
  
  let alert = (activeAlert && activeAlert.id === alertId) ? activeAlert : null;
  if (!alert) {
    const allHistory = await db.getAllHistory();
    alert = allHistory.find(e => e.id === alertId) || null;
  }

  if (alert) {
    const durationSeconds = Math.round((Date.now() - alert.timestamp) / 1000);
    
    alert.durationSeconds = durationSeconds;
    alert.status = 'Sent'; // Resolved status

    await db.updateHistoryEvent(alertId, {
      durationSeconds,
      status: 'Sent'
    });

    broadcastToReceivers(alertId, {
      type: 'status_update',
      status: 'Sent',
      durationSeconds
    });

    // Send immediate resolution email to emergency contacts and responders
    try {
      const targetUserId = alert.userId || req.userId;
      const user = await db.getUser(targetUserId);
      let contacts = await db.getContacts(targetUserId);
      if (contacts.length === 0) {
        contacts = [
          { id: 'police-dispatch', name: 'Emergency Police Dispatch', phone: '911', email: 'dispatch@emergency.gov', preferences: { gps: true, photos: true, video: true, audio: true, message: true } },
          { id: 'trusted-responders', name: 'Trusted Emergency Responders', phone: '+15550199', email: 'responders@silentsos.org', preferences: { gps: true, photos: true, video: true, audio: true, message: true } }
        ];
      }
      console.log(`✉️ Alert stopped/resolved! Dispatching resolution email for alert: ${alertId}`);
      sendResolvedEmail(user, contacts, alert, 'user');
    } catch (e) {
      console.error('Failed to dispatch alert resolution email on stop:', e);
    }

    if (activeAlert && activeAlert.id === alertId) {
      activeAlert = null;
    }
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Active alert not found' });
});

// Cancel active alert
app.post('/api/alerts/:id/cancel', async (req, res) => {
  const alertId = req.params.id;

  // Clear any active scheduled timers and recurring intervals
  clearAlertTimersAndIntervals(alertId);
  
  let alert = (activeAlert && activeAlert.id === alertId) ? activeAlert : null;
  if (!alert) {
    const allHistory = await db.getAllHistory();
    alert = allHistory.find(e => e.id === alertId) || null;
  }

  if (alert) {
    const durationSeconds = Math.round((Date.now() - alert.timestamp) / 1000);
    
    alert.durationSeconds = durationSeconds;
    alert.status = 'Cancelled';

    await db.updateHistoryEvent(alertId, {
      durationSeconds,
      status: 'Cancelled'
    });

    broadcastToReceivers(alertId, {
      type: 'status_update',
      status: 'Cancelled',
      durationSeconds
    });

    // Send immediate cancellation email to contacts
    try {
      const user = await db.getUser(alert.userId);
      let contacts = await db.getContacts(alert.userId);
      if (contacts.length === 0) {
        contacts = [
          { id: 'police-dispatch', name: 'Emergency Police Dispatch', phone: '911', email: 'dispatch@emergency.gov', preferences: { gps: true, photos: true, video: true, audio: true, message: true } },
          { id: 'trusted-responders', name: 'Trusted Emergency Responders', phone: '+15550199', email: 'responders@silentsos.org', preferences: { gps: true, photos: true, video: true, audio: true, message: true } }
        ];
      }
      console.log(`✉️ Alert cancelled! Dispatching cancellation email for alert: ${alertId}`);
      sendCancelEmail(user, contacts, alert);
    } catch (e) {
      console.error('Failed to dispatch cancellation email:', e);
    }

    if (activeAlert && activeAlert.id === alertId) {
      activeAlert = null;
    }
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Active alert not found' });
});

// Delete specific alert history and evidence
app.delete('/api/alerts/:id', async (req, res) => {
  const alertId = req.params.id;
  const userId = req.userId;

  try {
    const history = await db.removeHistoryEvent(userId, alertId);
    
    if (activeAlert && activeAlert.id === alertId) {
      activeAlert = null;
    }
    
    broadcastToReceivers(alertId, {
      type: 'status_update',
      status: 'Deleted',
      durationSeconds: 0
    });

    res.json(history);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 🔒 ADMIN ROUTE REGISTRATION & APIs
// ==========================================
app.use('/api/admin', requireAdmin);

// Admin stats & analytics
app.get('/api/admin/stats', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    const history = await db.getAllHistory();
    const feedback = await db.getAllFeedback();
    
    const activeCount = history.filter(h => h.status === 'Active').length;
    
    // Group registrations by day
    const registrations = users.reduce((acc, u) => {
      const ts = parseInt(u.id);
      const dateStr = !isNaN(ts) ? new Date(ts).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      acc[dateStr] = (acc[dateStr] || 0) + 1;
      return acc;
    }, {});
    
    // Group alerts by day
    const alertsByDate = history.reduce((acc, h) => {
      const dateStr = new Date(h.timestamp).toISOString().split('T')[0];
      acc[dateStr] = (acc[dateStr] || 0) + 1;
      return acc;
    }, {});

    // Group alerts by type
    const alertTypes = history.reduce((acc, h) => {
      const t = h.type || 'General';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const avgRating = feedback.length > 0 
      ? (feedback.reduce((sum, f) => sum + (f.rating || 5), 0) / feedback.length).toFixed(1)
      : '5.0';

    res.json({
      totalUsers: users.length,
      activeAlerts: activeCount,
      totalFeedback: feedback.length,
      avgRating,
      recentFeedback: feedback.slice(0, 5),
      registrations,
      alertsByDate,
      alertTypes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Users management routes
app.get('/api/admin/users', async (req, res) => {
  res.json(await db.getAllUsers());
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { name, email, role, disabled, password } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (role !== undefined) updates.role = role;
    if (disabled !== undefined) updates.disabled = !!disabled;
    if (password !== undefined && password.trim() !== '') updates.password = password;

    const user = await db.adminUpdateUser(req.params.id, updates);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }
    
    // Clean up active alert if it was owned by this user
    if (activeAlert && activeAlert.userId === targetId) {
      activeAlert = null;
    }

    await db.deleteUser(targetId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Alerts management routes
app.get('/api/admin/alerts', async (req, res) => {
  const history = await db.getAllHistory();
  const enriched = await Promise.all(history.map(async (h) => {
    const user = await db.getUser(h.userId);
    return {
      ...h,
      userName: user ? user.name : 'Unknown User',
      userEmail: user ? user.email : 'Unknown Email'
    };
  }));
  res.json(enriched);
});

app.post('/api/admin/alerts/:id/resolve', async (req, res) => {
  const alertId = req.params.id;

  clearAlertTimersAndIntervals(alertId);

  let alert = (activeAlert && activeAlert.id === alertId) ? activeAlert : null;
  if (!alert) {
    const allHistory = await db.getAllHistory();
    alert = allHistory.find(e => e.id === alertId) || null;
  }

  if (alert) {
    const durationSeconds = Math.round((Date.now() - alert.timestamp) / 1000);
    alert.durationSeconds = durationSeconds;
    alert.status = 'Sent'; // resolved status

    await db.updateHistoryEvent(alertId, {
      durationSeconds,
      status: 'Sent'
    });

    broadcastToReceivers(alertId, {
      type: 'status_update',
      status: 'Sent',
      durationSeconds
    });

    // Send immediate resolution email to emergency contacts and responders
    try {
      const user = await db.getUser(alert.userId);
      let contacts = await db.getContacts(alert.userId);
      if (contacts.length === 0) {
        contacts = [
          { id: 'police-dispatch', name: 'Emergency Police Dispatch', phone: '911', email: 'dispatch@emergency.gov', preferences: { gps: true, photos: true, video: true, audio: true, message: true } },
          { id: 'trusted-responders', name: 'Trusted Emergency Responders', phone: '+15550199', email: 'responders@silentsos.org', preferences: { gps: true, photos: true, video: true, audio: true, message: true } }
        ];
      }
      console.log(`✉️ Alert force-resolved by admin! Dispatching resolution email for alert: ${alertId}`);
      sendResolvedEmail(user, contacts, alert, 'admin');
    } catch (e) {
      console.error('Failed to dispatch alert resolution email on admin resolve:', e);
    }

    if (activeAlert && activeAlert.id === alertId) {
      activeAlert = null;
    }
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

app.delete('/api/admin/alerts/:id', async (req, res) => {
  try {
    const alertId = req.params.id;
    if (activeAlert && activeAlert.id === alertId) {
      activeAlert = null;
    }
    clearAlertTimersAndIntervals(alertId);
    await db.adminDeleteAlert(alertId);
    broadcastToReceivers(alertId, {
      type: 'status_update',
      status: 'Deleted',
      durationSeconds: 0
    });
    res.json({ success: true, message: 'Alert record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/alerts/export', async (req, res) => {
  try {
    const history = await db.getAllHistory();
    const headers = 'Alert ID,User Name,User Email,Timestamp,Type,Duration (s),Status,Photos Count,Videos Count,Audio Count\n';
    const rows = await Promise.all(history.map(async (h) => {
      const user = await db.getUser(h.userId);
      const uName = user ? user.name.replace(/"/g, '""') : 'Unknown';
      const uEmail = user ? user.email : 'Unknown';
      const dateStr = new Date(h.timestamp).toISOString();
      return `"${h.id}","${uName}","${uEmail}","${dateStr}","${h.type || 'General'}",${h.durationSeconds || 0},"${h.status || 'Active'}",${h.evidence?.photos || 0},${h.evidence?.videos || 0},${h.evidence?.audio || 0}`;
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=alerts_report.csv');
    res.status(200).send(headers + rows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin global recipient & global settings management
app.get('/api/admin/settings', async (req, res) => {
  res.json(await db.getSettings('global'));
});

app.put('/api/admin/settings', async (req, res) => {
  try {
    const settings = await db.updateSettings('global', req.body);
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Feedback Management APIs
app.get('/api/admin/feedback', async (req, res) => {
  try {
    const feedbackList = await db.getAllFeedback();
    res.json(feedbackList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/feedback/:id', async (req, res) => {
  try {
    await db.deleteFeedback(req.params.id);
    res.json({ success: true, message: 'Feedback entry deleted successfully.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/feedback/:id/reply', async (req, res) => {
  try {
    const { replyText } = req.body;
    if (!replyText || !replyText.trim()) {
      return res.status(400).json({ error: 'Please provide a response message.' });
    }

    const updated = await db.replyFeedback(req.params.id, replyText.trim());

    // Dispatch response email to user if email is present
    if (updated.userEmail) {
      try {
        await sendEmailViaResend({
          to: updated.userEmail,
          subject: `💬 Response to your SilentSOS Feedback (${updated.category})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden; background-color: #fafafa;">
              <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center; border-bottom: 3px solid #ec4899;">
                <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #f472b6;">SilentSOS Team Response</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Regarding your feedback</p>
              </div>
              <div style="padding: 24px; color: #333333; background-color: #ffffff;">
                <p style="font-size: 14px;">Hello <strong>${updated.userName}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
                  Thank you for submitting feedback to SilentSOS. Our emergency operations and engineering team has reviewed your note:
                </p>

                <div style="background-color: #f8fafc; border-left: 3px solid #cbd5e1; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #64748b; font-style: italic;">
                  "${updated.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
                </div>

                <div style="background-color: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <strong style="color: #be185d; font-size: 13px; text-transform: uppercase;">Team Response:</strong>
                  <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.6; color: #1e293b;">
                    ${replyText.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                  </p>
                </div>

                <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
                  Stay safe,<br/>SilentSOS Safety Support Team
                </p>
              </div>
            </div>
          `
        });
      } catch (mailErr) {
        console.warn('Failed to dispatch feedback reply email:', mailErr.message);
      }
    }

    res.json({ success: true, feedback: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/clear-all', async (req, res) => {
  await db.clearUserData(req.userId);
  activeAlert = null;
  res.json({ success: true });
});

server.listen(PORT, () => {
  console.log(`SilentSOS backend server listening at http://localhost:${PORT}`);
});

async function connectDatabaseWithRetry(retries = 5, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 Connecting to PostgreSQL database (Attempt ${attempt}/${retries})...`);
      await initDb();
      console.log('✅ PostgreSQL database initialized and synced successfully!');
      return;
    } catch (err) {
      console.error(`❌ DB initialization attempt ${attempt} failed:`, err.message);
      if (attempt < retries) {
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('⚠️ Could not connect to PostgreSQL after initial attempts. Retrying in background...');
        const bgTimer = setInterval(async () => {
          try {
            await initDb();
            console.log('✅ PostgreSQL database connected successfully in background!');
            clearInterval(bgTimer);
          } catch (e) {
            console.warn('Background reconnect attempt failed, will retry in 15s...');
          }
        }, 15000);
      }
    }
  }
}

connectDatabaseWithRetry();

export { app, server };
export default app;
