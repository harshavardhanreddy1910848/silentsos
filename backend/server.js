import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, initDb } from './db.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import dns from 'dns';

// Force DNS resolution to prefer IPv4 (fixes IPv6 ENETUNREACH issues in cloud environments like Railway)
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

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

// Helper to resolve host to IPv4 using dns.resolve4 to completely bypass IPv6 lookup issues
function resolveHostToIPv4(host) {
  return new Promise((resolve) => {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      return resolve(host);
    }
    dns.resolve4(host, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        console.warn(`⚠️ Failed to resolve host ${host} to IPv4:`, err ? err.message : 'no addresses');
        resolve(host); // Fallback to original hostname if resolve fails
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

// Initialize mail transporter
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const smtpHost = process.env.SMTP_HOST || 'smtp.ethereal.email';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    const resolvedHost = await resolveHostToIPv4(smtpHost);
    console.log(`✉️ Resolved SMTP host ${smtpHost} to IPv4: ${resolvedHost}`);

    mailTransporter = nodemailer.createTransport({
      host: resolvedHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        servername: smtpHost // Keep original host for SNI / TLS validation when using an IP host
      }
    });
    console.log(`✉️ Nodemailer SMTP configured using user: ${smtpUser}`);
  } else {
    // Generate Ethereal testing account as fallback
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

// Sends alert notification email to emergency contacts
async function sendAlertEmails(user, contacts, alert, isInitial = false) {
  try {
    const transporter = await getMailTransporter();
    if (!transporter) {
      console.warn('⚠️ Mail transporter not initialized. Skipping emails.');
      return;
    }

    const alertId = alert.id;
    const timeStr = new Date(alert.timestamp).toLocaleTimeString();
    const dateStr = new Date(alert.timestamp).toLocaleDateString();
    
    const broadcastLink = `${FRONTEND_URL}/receiver/${alertId}`;
    const latestCoords = alert.gpsPath && alert.gpsPath.length > 0 
      ? alert.gpsPath[alert.gpsPath.length - 1] 
      : null;
    
    if (!latestCoords) {
      console.warn(`⚠️ Alert ${alertId} has no GPS coordinates. Skipping email dispatch.`);
      return;
    }
    
    const googleMapsLink = latestCoords.googleMapsLink || `https://maps.google.com/?q=${latestCoords.lat},${latestCoords.lng}`;
    const locationTimeStr = latestCoords.timestamp 
      ? new Date(latestCoords.timestamp).toISOString() 
      : new Date(alert.timestamp).toISOString();

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
        name: `Global Responder`,
        email: email,
        preferences: { gps: true, photos: true, video: true, audio: true, message: true }
      }));
    }

    const emailRecipients = [
      ...contacts.filter(c => c.email),
      ...extraRecipients
    ];

    if (emailRecipients.length === 0) {
      console.log('✉️ No contacts or global emails. Skipping email dispatch.');
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
              This is an automated emergency alert dispatch. User <strong>${user.name}</strong> triggered distress response from SilentSOS.
            </p>
            
            <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #9f1239; font-size: 14px; font-weight: bold;">ALERT DETAILS:</h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #4c0519;">
                <li><strong>Distress Type:</strong> ${alert.type || 'General Distress'}</li>
                <li><strong>Trigger Date:</strong> ${dateStr}</li>
                <li><strong>Trigger Time:</strong> ${timeStr}</li>
                <li><strong>Current Status:</strong> ${alert.status}</li>
                <li><strong>GPS Latitude:</strong> ${latestCoords.lat}</li>
                <li><strong>GPS Longitude:</strong> ${latestCoords.lng}</li>
                <li><strong>Google Maps Link:</strong> <a href="${googleMapsLink}" style="color: #ef4444; text-decoration: underline;">${googleMapsLink}</a></li>
                <li><strong>Location Timestamp:</strong> ${locationTimeStr}</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0 20px 0;">
              <a href="${broadcastLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                🛰️ Track Location & Evidence Live
              </a>
              <p style="margin: 8px 0 0 0;"><a href="${googleMapsLink}" style="color: #ef4444; font-size: 12px; text-decoration: underline;">Open in Google Maps</a></p>
            </div>
      `;

      const attachments = [];
      
      if (!isInitial && alert.evidence && alert.evidence.files && alert.evidence.files.length > 0) {
        htmlContent += `
            <div style="margin-top: 24px; border-top: 1px solid #e1e1e1; padding-top: 20px;">
              <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: bold;">🔒 RECORDED EVIDENCE ENCLOSED:</h3>
              <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 16px;">
                Find live evidence files linked and attached to this email. For real-time updates, use the broadcast tracker link above.
              </p>
              <ul style="font-size: 13px; line-height: 1.6; color: #4b5563; padding-left: 20px;">
        `;

        alert.evidence.files.forEach((file, idx) => {
          const fileUrl = `${APP_URL}${file.url}`;
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
            ℹ️ Silent photo, video, and microphone capturing sequences are executing. Media evidence files will be sent in a separate update email within a few seconds.
          </p>
        `;
      }

      htmlContent += `
          </div>
          <div style="background-color: #f3f4f6; color: #6b7280; padding: 16px; text-align: center; font-size: 11px; border-top: 1px solid #e1e1e1;">
            This email was dispatched automatically by SilentSOS safety response systems.<br/>
            Ref Alert ID: ${alertId}
          </div>
        </div>
      `;

      const subject = isInitial 
        ? `🚨 SilentSOS INITIAL WARNING: Emergency alert triggered by ${user.name}` 
        : `🔒 SilentSOS EVIDENCE ENCLOSED: Emergency alert update for ${user.name}`;

      const info = await transporter.sendMail({
        from: `"SilentSOS System" <${transporter.options.auth.user}>`,
        to: contact.email,
        subject: subject,
        html: htmlContent,
        attachments: attachments
      });

      console.log(`✉️ Email successfully dispatched to ${contact.email} (MessageID: ${info.messageId})`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
    }
  } catch (err) {
    lastMailError = { message: err.message, stack: err.stack, time: new Date().toISOString() };
    console.error('❌ Failed to send alert emails:', err);
  }
}

// Sends cancellation email when user cancels alert
async function sendCancelEmail(user, contacts, alert) {
  try {
    const transporter = await getMailTransporter();
    if (!transporter) {
      console.warn('⚠️ Mail transporter not initialized. Skipping cancel email.');
      return;
    }

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
        name: `Global Responder`,
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
              This is a follow-up notification from SilentSOS. User <strong>${user.name}</strong> has successfully cancelled the active emergency alert at <strong>${timeStr}</strong>.
            </p>
            
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: bold;">STATUS Update:</p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #064e3b;">
                <li><strong>Distress Type:</strong> ${alert.type || 'General'}</li>
                <li><strong>Current Status:</strong> Cancelled (User is safe)</li>
                <li><strong>Resolved Time:</strong> ${timeStr}</li>
              </ul>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; line-height: 1.5; border-top: 1px solid #e1e1e1; padding-top: 15px;">
              No further emergency action is required. You can still review the captured evidence and track logs at the original broadcast link.
            </p>
          </div>
          <div style="background-color: #f3f4f6; color: #6b7280; padding: 16px; text-align: center; font-size: 11px; border-top: 1px solid #e1e1e1;">
            This email was dispatched automatically by SilentSOS safety response systems.<br/>
            Ref Alert ID: ${alertId}
          </div>
        </div>
      `;

      const subject = `✅ SilentSOS RESOLVED: Emergency alert cancelled by ${user.name}`;

      const info = await transporter.sendMail({
        from: `"SilentSOS System" <${transporter.options.auth.user}>`,
        to: contact.email,
        subject: subject,
        html: htmlContent
      });

      console.log(`✉️ Cancel email successfully dispatched to ${contact.email} (MessageID: ${info.messageId})`);
    }
  } catch (err) {
    console.error('❌ Failed to send cancel emails:', err);
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

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['*'] }));
app.use(express.json());
app.use('/evidence', express.static(EVIDENCE_DIR));

// Serve static files from the React frontend app build directory in production
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  console.log(`🚀 Serving frontend static assets from: ${frontendBuildPath}`);
} else {
  // Health check / root route (only if frontend build is not served directly)
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
          <p style="font-size:12px; margin-top:20px;">Frontend: <a href="${FRONTEND_URL}" style="color:#f472b6;">${FRONTEND_URL}</a></p>
        </div>
      </body>
      </html>
    `);
  });
}

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

app.get('/api/debug/last-alert', async (req, res) => {
  try {
    const history = await db.getAllHistory();
    if (history.length === 0) {
      return res.json({ message: 'No alerts in history' });
    }
    const lastAlert = history[0];
    const user = await db.getUser(lastAlert.userId);
    const contacts = await db.getContacts(lastAlert.userId);
    res.json({
      lastAlert,
      user,
      contacts
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
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
            const gpsPoint = { 
              lat, 
              lng, 
              timestamp: timestamp || Date.now(),
              googleMapsLink: `https://maps.google.com/?q=${lat},${lng}`
            };
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
  const broadcastLink = `${FRONTEND_URL}/receiver/${alertId}`;

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

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, password } = req.body;
  try {
    await db.resetPassword(email, password);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    const { name, password } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (password !== undefined && password.trim() !== '') {
      updates.password = password;
    }
    const user = await db.adminUpdateUser(req.userId, updates);
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
    timestamp: location.timestamp || Date.now(),
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
      timestamp: location.timestamp || Date.now(),
      googleMapsLink: location.googleMapsLink || `https://maps.google.com/?q=${initialLat},${initialLng}`
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

  res.json(newAlert);
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

  // Clear any active scheduled timers
  if (activeAlertTimers.has(alertId)) {
    clearTimeout(activeAlertTimers.get(alertId));
    activeAlertTimers.delete(alertId);
  }
  
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

  // Clear any active scheduled timers
  if (activeAlertTimers.has(alertId)) {
    clearTimeout(activeAlertTimers.get(alertId));
    activeAlertTimers.delete(alertId);
  }
  
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

    res.json({
      totalUsers: users.length,
      activeAlerts: activeCount,
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

  if (activeAlertTimers.has(alertId)) {
    clearTimeout(activeAlertTimers.get(alertId));
    activeAlertTimers.delete(alertId);
  }

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

    if (activeAlert && activeAlert.id === alertId) {
      activeAlert = null;
    }
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Alert not found' });
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

app.post('/api/clear-all', async (req, res) => {
  await db.clearUserData(req.userId);
  activeAlert = null;
  res.json({ success: true });
});

// Catch-all route to serve React's index.html in production (for client-side routing)
if (fs.existsSync(frontendBuildPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/evidence')) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`SilentSOS backend server listening at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize SQLite3 database:', err);
  process.exit(1);
});
