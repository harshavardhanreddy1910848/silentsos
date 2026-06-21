import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize PostgreSQL Connection Pool
const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=') ? undefined : { rejectUnauthorized: false }
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'silentsos',
      ssl: { rejectUnauthorized: false }
    };

const pool = new pg.Pool(connectionConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Helper to convert camelCase to snake_case for dynamic update properties
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Helper to convert SQLite style ? to PostgreSQL style $1, $2, $3...
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// PG Wrapper queries mimicking standard SQLite methods
async function run(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return { changes: result.rowCount };
}

async function get(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows;
}

// AES-256-CBC encryption key (32 bytes)
const ENCRYPTION_KEY = crypto.scryptSync('silentsos-womens-safety-secret-salt-key-2026', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed, returning input text:', err.message);
    return text;
  }
}

// Simple password hashing
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const defaultSettings = {
  gestureSensitivity: 'Medium',
  autoRepeatInterval: 5,
  photoBurstCount: 5,
  videoDuration: '1min',
  audioQuality: 'high',
  cameraPreference: 'both',
  fakeCallDisguise: false,
  stealthMode: false,
  messageTemplate: '🚨 EMERGENCY ALERT — SilentSOS\nFrom: {name}\nTime: {time}\nType: {type}\n\n📍 GPS Location: {gps_link}\n\n⚠️ Please respond immediately or call emergency services. Updates every 5 minutes until you acknowledge.',
  safetyPin: '1234',
  autoDeleteDays: 30,
  globalEmergencyEmails: ''
};

// Map database row models to standard JS objects matching application signatures
function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role || 'user',
    disabled: row.disabled === true || row.disabled === 1,
    isSetupComplete: row.is_setup_complete === true || row.is_setup_complete === 1
  };
}

function mapSettingsRow(row) {
  if (!row) return null;
  return {
    gestureSensitivity: row.gesture_sensitivity || 'Medium',
    autoRepeatInterval: row.auto_repeat_interval !== undefined && row.auto_repeat_interval !== null ? row.auto_repeat_interval : 5,
    photoBurstCount: row.photo_burst_count !== undefined && row.photo_burst_count !== null ? row.photo_burst_count : 5,
    videoDuration: row.video_duration || '1min',
    audioQuality: row.audio_quality || 'high',
    cameraPreference: row.camera_preference || 'both',
    fakeCallDisguise: row.fake_call_disguise === true || row.fake_call_disguise === 1,
    stealthMode: row.stealth_mode === true || row.stealth_mode === 1,
    messageTemplate: row.message_template || defaultSettings.messageTemplate,
    safetyPin: row.safety_pin || '1234',
    autoDeleteDays: row.auto_delete_days !== undefined && row.auto_delete_days !== null ? row.auto_delete_days : 30,
    globalEmergencyEmails: row.global_emergency_emails || ''
  };
}

function mapContactRow(row) {
  if (!row) return null;
  let preferences = { gps: true, photos: true, video: true, audio: true, message: true };
  if (row.preferences) {
    if (typeof row.preferences === 'object') {
      preferences = row.preferences;
    } else {
      try {
        preferences = JSON.parse(row.preferences);
      } catch (e) {}
    }
  }
  return {
    id: row.id,
    name: row.name,
    phone: decrypt(row.phone_enc),
    email: decrypt(row.email_enc),
    preferences
  };
}

function mapHistoryRow(row) {
  if (!row) return null;
  let evidence = { photos: 0, videos: 0, audio: 0, files: [] };
  if (row.evidence) {
    if (typeof row.evidence === 'object') {
      evidence = row.evidence;
    } else {
      try {
        evidence = JSON.parse(row.evidence);
      } catch (e) {}
    }
  }
  let contactsNotified = [];
  if (row.contacts_notified) {
    if (typeof row.contacts_notified === 'object') {
      contactsNotified = row.contacts_notified;
    } else {
      try {
        contactsNotified = JSON.parse(row.contacts_notified);
      } catch (e) {}
    }
  }
  let gpsPath = [];
  if (row.gps_path_enc) {
    try {
      gpsPath = JSON.parse(decrypt(row.gps_path_enc));
    } catch (e) {}
  }
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: row.timestamp ? Number(row.timestamp) : null,
    type: row.type || 'General',
    durationSeconds: row.duration_seconds || 0,
    status: row.status,
    evidence,
    contactsNotified,
    gpsPath
  };
}

// Database schema table setup
export async function initDb() {
  // Setup tables if they do not exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255),
      name VARCHAR(255),
      role VARCHAR(50),
      disabled BOOLEAN DEFAULT FALSE,
      is_setup_complete BOOLEAN DEFAULT FALSE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255),
      phone_enc TEXT,
      email_enc TEXT,
      preferences JSONB
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      user_id VARCHAR(255) PRIMARY KEY,
      gesture_sensitivity VARCHAR(50),
      auto_repeat_interval INTEGER,
      photo_burst_count INTEGER,
      video_duration VARCHAR(50),
      audio_quality VARCHAR(50),
      camera_preference VARCHAR(50),
      fake_call_disguise BOOLEAN DEFAULT FALSE,
      stealth_mode BOOLEAN DEFAULT FALSE,
      message_template TEXT,
      safety_pin VARCHAR(50),
      auto_delete_days INTEGER,
      global_emergency_emails TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS history (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      timestamp BIGINT,
      type VARCHAR(100),
      duration_seconds INTEGER,
      status VARCHAR(50),
      evidence JSONB,
      contacts_notified JSONB,
      gps_path_enc TEXT
    )
  `);

  await seedAdmin();
}

async function seedAdmin() {
  const adminRow = await get(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`);
  if (!adminRow || parseInt(adminRow.count) === 0) {
    const adminId = 'admin-system';
    await run(
      `INSERT INTO users (id, email, password_hash, name, role, disabled, is_setup_complete) 
       VALUES (?, ?, ?, ?, ?, false, true) ON CONFLICT (id) DO NOTHING`,
      [adminId, 'admin@silentsos.com', hashPassword('admin123'), 'System Administrator', 'admin']
    );
    await run(
      `INSERT INTO settings (
        user_id, gesture_sensitivity, auto_repeat_interval, photo_burst_count, 
        video_duration, audio_quality, camera_preference, fake_call_disguise, 
        stealth_mode, message_template, safety_pin, auto_delete_days, global_emergency_emails
       ) VALUES (?, ?, ?, ?, ?, ?, ?, false, false, ?, ?, ?, '') ON CONFLICT (user_id) DO NOTHING`,
      [
        adminId,
        defaultSettings.gestureSensitivity,
        defaultSettings.autoRepeatInterval,
        defaultSettings.photoBurstCount,
        defaultSettings.videoDuration,
        defaultSettings.audioQuality,
        defaultSettings.cameraPreference,
        defaultSettings.messageTemplate,
        defaultSettings.safetyPin,
        defaultSettings.autoDeleteDays
      ]
    );
    console.log('✉️ Seeded default admin account: admin@silentsos.com (pwd: admin123)');
  }

  const userToPromote = await get(`SELECT * FROM users WHERE LOWER(email) = ?`, ['harshavardhanreddy1910848@gmail.com']);
  if (userToPromote && userToPromote.role !== 'admin') {
    await run(`UPDATE users SET role = 'admin' WHERE LOWER(email) = ?`, ['harshavardhanreddy1910848@gmail.com']);
    console.log('✉️ Automatically promoted harshavardhanreddy1910848@gmail.com to administrator');
  }
}

// Exported Database methods
export const db = {
  // Authentication methods
  async registerUser(email, password, name) {
    const existing = await get(`SELECT id FROM users WHERE LOWER(email) = ?`, [email.toLowerCase()]);
    if (existing) {
      throw new Error('User already exists');
    }
    const userId = Date.now().toString();
    const hash = hashPassword(password);
    
    await run(
      `INSERT INTO users (id, email, password_hash, name, role, disabled, is_setup_complete) VALUES (?, ?, ?, ?, 'user', false, false)`,
      [userId, email.toLowerCase(), hash, name || '']
    );
    await run(
      `INSERT INTO settings (
        user_id, gesture_sensitivity, auto_repeat_interval, photo_burst_count, 
        video_duration, audio_quality, camera_preference, fake_call_disguise, 
        stealth_mode, message_template, safety_pin, auto_delete_days, global_emergency_emails
       ) VALUES (?, ?, ?, ?, ?, ?, ?, false, false, ?, ?, ?, '')`,
      [
        userId,
        defaultSettings.gestureSensitivity,
        defaultSettings.autoRepeatInterval,
        defaultSettings.photoBurstCount,
        defaultSettings.videoDuration,
        defaultSettings.audioQuality,
        defaultSettings.cameraPreference,
        defaultSettings.messageTemplate,
        defaultSettings.safetyPin,
        defaultSettings.autoDeleteDays
      ]
    );
    return this.getUser(userId);
  },

  async authenticateUser(email, password) {
    const row = await get(
      `SELECT * FROM users WHERE LOWER(email) = ? AND password_hash = ?`,
      [email.toLowerCase(), hashPassword(password)]
    );
    if (!row) {
      throw new Error('Invalid email or password');
    }
    return mapUserRow(row);
  },

  async resetPassword(email, newPassword) {
    const user = await get(`SELECT id FROM users WHERE LOWER(email) = ?`, [email.toLowerCase()]);
    if (!user) {
      throw new Error('User with this email does not exist');
    }
    await run(`UPDATE users SET password_hash = ? WHERE LOWER(email) = ?`, [hashPassword(newPassword), email.toLowerCase()]);
    return this.getUser(user.id);
  },

  async getUser(userId) {
    const row = await get(`SELECT * FROM users WHERE id = ?`, [userId]);
    return mapUserRow(row);
  },

  async updateUserProfile(userId, updates) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getUser(userId);
    const pgKeys = keys.map(camelToSnake);
    const setClause = pgKeys.map((k, i) => `${k} = ?`).join(', ');
    const params = [
      ...keys.map(k => updates[k]),
      userId
    ];
    await run(`UPDATE users SET ${setClause} WHERE id = ?`, params);
    return this.getUser(userId);
  },

  // Contacts
  async getContacts(userId) {
    const rows = await all(`SELECT * FROM contacts WHERE user_id = ?`, [userId]);
    return rows.map(mapContactRow);
  },

  async addContact(userId, contact) {
    const contactId = contact.id || Date.now().toString();
    const phoneEnc = encrypt(contact.phone);
    const emailEnc = encrypt(contact.email);
    const prefStr = JSON.stringify(contact.preferences || {});

    await run(
      `INSERT INTO contacts (id, user_id, name, phone_enc, email_enc, preferences) VALUES (?, ?, ?, ?, ?, ?)`,
      [contactId, userId, contact.name, phoneEnc, emailEnc, prefStr]
    );
    return this.getContacts(userId);
  },

  async updateContact(userId, contactId, updates) {
    const row = await get(`SELECT * FROM contacts WHERE id = ? AND user_id = ?`, [contactId, userId]);
    if (!row) return this.getContacts(userId);

    const name = updates.name !== undefined ? updates.name : row.name;
    const phoneEnc = updates.phone ? encrypt(updates.phone) : row.phone_enc;
    const emailEnc = updates.email ? encrypt(updates.email) : row.email_enc;
    
    let preferences = row.preferences;
    if (updates.preferences) {
      preferences = JSON.stringify(updates.preferences);
    } else if (typeof row.preferences === 'object' && row.preferences !== null) {
      preferences = JSON.stringify(row.preferences);
    }

    await run(
      `UPDATE contacts SET name = ?, phone_enc = ?, email_enc = ?, preferences = ? WHERE id = ? AND user_id = ?`,
      [name, phoneEnc, emailEnc, preferences, contactId, userId]
    );
    return this.getContacts(userId);
  },

  async removeContact(userId, contactId) {
    await run(`DELETE FROM contacts WHERE id = ? AND user_id = ?`, [contactId, userId]);
    return this.getContacts(userId);
  },

  // Settings
  async getSettings(userId) {
    const row = await get(`SELECT * FROM settings WHERE user_id = ?`, [userId]);
    if (!row) {
      return { ...defaultSettings };
    }
    return mapSettingsRow(row);
  },

  async updateSettings(userId, updates) {
    const current = await get(`SELECT * FROM settings WHERE user_id = ?`, [userId]);
    const merged = { ...defaultSettings, ...mapSettingsRow(current), ...updates };

    await run(
      `INSERT INTO settings (
        user_id, gesture_sensitivity, auto_repeat_interval, photo_burst_count, 
        video_duration, audio_quality, camera_preference, fake_call_disguise, 
        stealth_mode, message_template, safety_pin, auto_delete_days, global_emergency_emails
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         gesture_sensitivity = EXCLUDED.gesture_sensitivity,
         auto_repeat_interval = EXCLUDED.auto_repeat_interval,
         photo_burst_count = EXCLUDED.photo_burst_count,
         video_duration = EXCLUDED.video_duration,
         audio_quality = EXCLUDED.audio_quality,
         camera_preference = EXCLUDED.camera_preference,
         fake_call_disguise = EXCLUDED.fake_call_disguise,
         stealth_mode = EXCLUDED.stealth_mode,
         message_template = EXCLUDED.message_template,
         safety_pin = EXCLUDED.safety_pin,
         auto_delete_days = EXCLUDED.auto_delete_days,
         global_emergency_emails = EXCLUDED.global_emergency_emails`,
      [
        userId,
        merged.gestureSensitivity,
        merged.autoRepeatInterval,
        merged.photoBurstCount,
        merged.videoDuration,
        merged.audioQuality,
        merged.cameraPreference,
        merged.fakeCallDisguise,
        merged.stealthMode,
        merged.messageTemplate,
        merged.safetyPin,
        merged.autoDeleteDays,
        merged.globalEmergencyEmails || ''
      ]
    );
    return this.getSettings(userId);
  },

  // History
  async getHistory(userId) {
    const rows = await all(`SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC`, [userId]);
    return rows.map(mapHistoryRow);
  },

  async addHistoryEvent(userId, event) {
    const evidenceStr = JSON.stringify(event.evidence || {});
    const notifyStr = JSON.stringify(event.contactsNotified || []);
    const gpsPathEnc = encrypt(JSON.stringify(event.gpsPath || []));

    await run(
      `INSERT INTO history (id, user_id, timestamp, type, duration_seconds, status, evidence, contacts_notified, gps_path_enc) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id, 
        userId, 
        event.timestamp ? BigInt(event.timestamp) : null, 
        event.type || 'General', 
        event.durationSeconds || 0, 
        event.status, 
        evidenceStr, 
        notifyStr, 
        gpsPathEnc
      ]
    );
    return this.getHistory(userId);
  },

  async removeHistoryEvent(userId, alertId) {
    const row = await get(`SELECT evidence FROM history WHERE id = ? AND user_id = ?`, [alertId, userId]);
    if (row && row.evidence) {
      try {
        let evidence = row.evidence;
        if (typeof evidence === 'string') {
          evidence = JSON.parse(evidence);
        }
        if (evidence && evidence.files) {
          evidence.files.forEach(file => {
            const fileName = path.basename(file.url);
            const fullPath = path.join(__dirname, 'evidence', fileName);
            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
                console.log(`🗑️ Deleted evidence file: ${fullPath}`);
              } catch (err) {
                console.error(`Failed to delete evidence file: ${fullPath}`, err);
              }
            }
          });
        }
      } catch (e) {}
    }

    await run(`DELETE FROM history WHERE id = ? AND user_id = ?`, [alertId, userId]);
    return this.getHistory(userId);
  },

  async updateHistoryEvent(alertId, updates) {
    const row = await get(`SELECT * FROM history WHERE id = ?`, [alertId]);
    if (!row) return;

    const durationSeconds = updates.durationSeconds !== undefined ? updates.durationSeconds : row.duration_seconds;
    const status = updates.status || row.status;
    
    let evidence = row.evidence;
    if (updates.evidence) {
      evidence = JSON.stringify(updates.evidence);
    } else if (typeof row.evidence === 'object' && row.evidence !== null) {
      evidence = JSON.stringify(row.evidence);
    }

    let contactsNotified = row.contacts_notified;
    if (updates.contactsNotified) {
      contactsNotified = JSON.stringify(updates.contactsNotified);
    } else if (typeof row.contacts_notified === 'object' && row.contacts_notified !== null) {
      contactsNotified = JSON.stringify(row.contacts_notified);
    }

    const gpsPathEnc = updates.gpsPath ? encrypt(JSON.stringify(updates.gpsPath)) : row.gps_path_enc;

    await run(
      `UPDATE history SET duration_seconds = ?, status = ?, evidence = ?, contacts_notified = ?, gps_path_enc = ? WHERE id = ?`,
      [durationSeconds, status, evidence, contactsNotified, gpsPathEnc, alertId]
    );
  },

  async clearUserData(userId) {
    await run(`DELETE FROM contacts WHERE user_id = ?`, [userId]);
    
    // Clean files from history before deleting rows
    const rows = await all(`SELECT evidence FROM history WHERE user_id = ?`, [userId]);
    for (const row of rows) {
      if (row.evidence) {
        try {
          let evidence = row.evidence;
          if (typeof evidence === 'string') {
            evidence = JSON.parse(evidence);
          }
          if (evidence.files) {
            evidence.files.forEach(file => {
              const fileName = path.basename(file.url);
              const fullPath = path.join(__dirname, 'evidence', fileName);
              if (fs.existsSync(fullPath)) {
                try {
                  fs.unlinkSync(fullPath);
                } catch (e) {}
              }
            });
          }
        } catch (e) {}
      }
    }
    
    await run(`DELETE FROM history WHERE user_id = ?`, [userId]);
    await run(`DELETE FROM settings WHERE user_id = ?`, [userId]);
    await run(`UPDATE users SET is_setup_complete = false WHERE id = ?`, [userId]);
  },

  async getAllHistory() {
    const rows = await all(`SELECT * FROM history ORDER BY timestamp DESC`);
    return rows.map(mapHistoryRow);
  },

  async getAllUsers() {
    const rows = await all(`SELECT * FROM users`);
    return rows.map(mapUserRow);
  },

  async adminUpdateUser(userId, updates) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getUser(userId);

    // Filter password update specifically
    const dbUpdates = { ...updates };
    if (updates.password) {
      dbUpdates.password_hash = hashPassword(updates.password);
      delete dbUpdates.password;
    }

    const setKeys = Object.keys(dbUpdates);
    const pgKeys = setKeys.map(camelToSnake);
    const setClause = pgKeys.map((k, i) => `${k} = ?`).join(', ');
    const params = [
      ...setKeys.map(k => dbUpdates[k]),
      userId
    ];

    await run(`UPDATE users SET ${setClause} WHERE id = ?`, params);
    return this.getUser(userId);
  },

  async deleteUser(userId) {
    // 1. Delete user record
    await run(`DELETE FROM users WHERE id = ?`, [userId]);
    // 2. Delete settings
    await run(`DELETE FROM settings WHERE user_id = ?`, [userId]);
    // 3. Delete contacts
    await run(`DELETE FROM contacts WHERE user_id = ?`, [userId]);
    
    // 4. Delete evidence files and history
    const rows = await all(`SELECT evidence FROM history WHERE user_id = ?`, [userId]);
    for (const row of rows) {
      if (row.evidence) {
        try {
          let evidence = row.evidence;
          if (typeof evidence === 'string') {
            evidence = JSON.parse(evidence);
          }
          if (evidence.files) {
            evidence.files.forEach(file => {
              const fileName = path.basename(file.url);
              const fullPath = path.join(__dirname, 'evidence', fileName);
              if (fs.existsSync(fullPath)) {
                try {
                  fs.unlinkSync(fullPath);
                } catch (e) {}
              }
            });
          }
        } catch (e) {}
      }
    }
    await run(`DELETE FROM history WHERE user_id = ?`, [userId]);
    return true;
  }
};
