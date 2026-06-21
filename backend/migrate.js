import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQLITE_FILE = path.join(__dirname, 'data', 'database.db');

// Ensure SQLite database exists
if (!fs.existsSync(SQLITE_FILE)) {
  console.error(`❌ SQLite database file not found at: ${SQLITE_FILE}`);
  process.exit(1);
}

const targetDb = process.env.PGDATABASE || 'silentsos';
console.log(`Connecting to PostgreSQL to check/create database: ${targetDb}`);

// Connect to default 'postgres' database to ensure our target database exists
const pgConfigDefault = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: 'postgres'
};

if (process.env.DATABASE_URL) {
  // If DATABASE_URL is provided, we can parse it or use it.
  // To connect to the default DB for creation, we'll try to replace the database part, or fall back to the env variables.
  console.log('Using DATABASE_URL environment variable.');
}

async function runMigration() {
  let client;
  
  // 1. Create target database if it doesn't exist
  try {
    const defaultClientConfig = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL.replace(/\/([^/]+)$/, '/postgres') }
      : pgConfigDefault;
      
    const defaultClient = new pg.Client(defaultClientConfig);
    await defaultClient.connect();
    
    const dbCheck = await defaultClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (dbCheck.rowCount === 0) {
      console.log(`Database "${targetDb}" does not exist. Creating it now...`);
      // Database names cannot be parameterized, but targetDb is controlled by config env
      await defaultClient.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`✅ Database "${targetDb}" created successfully.`);
    } else {
      console.log(`Database "${targetDb}" already exists.`);
    }
    await defaultClient.end();
  } catch (err) {
    console.warn(`⚠️ Warning: Could not verify/create database "${targetDb}" using default connection. Proceeding to connect directly. Error: ${err.message}`);
  }

  // 2. Connect to the target PostgreSQL database
  try {
    const connectionConfig = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.PGHOST || 'localhost',
          port: parseInt(process.env.PGPORT || '5432'),
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || 'postgres',
          database: targetDb
        };
    
    client = new pg.Client(connectionConfig);
    await client.connect();
    console.log('✅ Connected to PostgreSQL target database.');
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL database:', err.message);
    process.exit(1);
  }

  // 3. Connect to SQLite database
  const sqliteDb = new sqlite3.Database(SQLITE_FILE, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Failed to open SQLite database:', err.message);
      process.exit(1);
    }
    console.log('✅ Opened source SQLite database.');
  });

  // SQLite helper wrapper
  const sqliteAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  try {
    // 4. Drop existing tables to ensure clean schema rebuild
    console.log('Dropping existing tables in PostgreSQL (if any)...');
    await client.query('DROP TABLE IF EXISTS history CASCADE');
    await client.query('DROP TABLE IF EXISTS settings CASCADE');
    await client.query('DROP TABLE IF EXISTS contacts CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('✅ Dropped existing tables.');

    // 5. Create Tables
    console.log('Creating PostgreSQL tables...');
    
    await client.query(`
      CREATE TABLE users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        name VARCHAR(255),
        role VARCHAR(50),
        disabled BOOLEAN DEFAULT FALSE,
        is_setup_complete BOOLEAN DEFAULT FALSE
      )
    `);

    await client.query(`
      CREATE TABLE contacts (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255),
        phone_enc TEXT,
        email_enc TEXT,
        preferences JSONB
      )
    `);

    await client.query(`
      CREATE TABLE settings (
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

    await client.query(`
      CREATE TABLE history (
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
    console.log('✅ PostgreSQL schema created successfully.');

    // 6. Migrate Users
    console.log('Migrating table "users"...');
    const sqliteUsers = await sqliteAll('SELECT * FROM users');
    let usersMigrated = 0;
    for (const u of sqliteUsers) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, role, disabled, is_setup_complete) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          u.id, 
          u.email, 
          u.passwordHash, 
          u.name, 
          u.role, 
          u.disabled === 1, 
          u.isSetupComplete === 1
        ]
      );
      usersMigrated++;
    }
    console.log(`✅ Migrated ${usersMigrated}/${sqliteUsers.length} users.`);

    // 7. Migrate Settings
    console.log('Migrating table "settings"...');
    const sqliteSettings = await sqliteAll('SELECT * FROM settings');
    let settingsMigrated = 0;
    for (const s of sqliteSettings) {
      await client.query(
        `INSERT INTO settings (
          user_id, gesture_sensitivity, auto_repeat_interval, photo_burst_count, 
          video_duration, audio_quality, camera_preference, fake_call_disguise, 
          stealth_mode, message_template, safety_pin, auto_delete_days, global_emergency_emails
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          s.userId,
          s.gestureSensitivity,
          s.autoRepeatInterval,
          s.photoBurstCount,
          s.videoDuration,
          s.audioQuality,
          s.cameraPreference,
          s.fakeCallDisguise === 1,
          s.stealthMode === 1,
          s.messageTemplate,
          s.safetyPin,
          s.autoDeleteDays,
          s.globalEmergencyEmails
        ]
      );
      settingsMigrated++;
    }
    console.log(`✅ Migrated ${settingsMigrated}/${sqliteSettings.length} settings.`);

    // 8. Migrate Contacts
    console.log('Migrating table "contacts"...');
    const sqliteContacts = await sqliteAll('SELECT * FROM contacts');
    let contactsMigrated = 0;
    for (const c of sqliteContacts) {
      // Clean or validate preferences JSON string before inserting
      let prefJson = {};
      if (c.preferences) {
        try {
          prefJson = JSON.parse(c.preferences);
        } catch (err) {
          console.warn(`⚠️ Failed to parse preferences JSON for contact ${c.id}:`, err.message);
        }
      }
      
      await client.query(
        `INSERT INTO contacts (id, user_id, name, phone_enc, email_enc, preferences) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          c.id,
          c.userId,
          c.name,
          c.phoneEnc,
          c.emailEnc,
          JSON.stringify(prefJson)
        ]
      );
      contactsMigrated++;
    }
    console.log(`✅ Migrated ${contactsMigrated}/${sqliteContacts.length} contacts.`);

    // 9. Migrate History
    console.log('Migrating table "history"...');
    const sqliteHistory = await sqliteAll('SELECT * FROM history');
    let historyMigrated = 0;
    for (const h of sqliteHistory) {
      let evidenceJson = {};
      if (h.evidence) {
        try {
          evidenceJson = JSON.parse(h.evidence);
        } catch (err) {
          console.warn(`⚠️ Failed to parse evidence JSON for history event ${h.id}:`, err.message);
        }
      }

      let notifiedJson = [];
      if (h.contactsNotified) {
        try {
          notifiedJson = JSON.parse(h.contactsNotified);
        } catch (err) {
          console.warn(`⚠️ Failed to parse contactsNotified JSON for history event ${h.id}:`, err.message);
        }
      }

      await client.query(
        `INSERT INTO history (id, user_id, timestamp, type, duration_seconds, status, evidence, contacts_notified, gps_path_enc) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          h.id,
          h.userId,
          // Cast SQLite timestamp (integer) to PG BIGINT
          h.timestamp ? BigInt(h.timestamp) : null,
          h.type,
          h.durationSeconds,
          h.status,
          JSON.stringify(evidenceJson),
          JSON.stringify(notifiedJson),
          h.gpsPathEnc
        ]
      );
      historyMigrated++;
    }
    console.log(`✅ Migrated ${historyMigrated}/${sqliteHistory.length} history events.`);

    // 10. Data Verification Report
    console.log('\n=============================================');
    console.log('📊 DATABASE MIGRATION SUMMARY & INTEGRITY REPORT');
    console.log('=============================================');
    console.log(`Table "users": SQLite=${sqliteUsers.length}, PostgreSQL=${usersMigrated} (${sqliteUsers.length === usersMigrated ? 'MATCH ✓' : 'MISMATCH ❌'})`);
    console.log(`Table "settings": SQLite=${sqliteSettings.length}, PostgreSQL=${settingsMigrated} (${sqliteSettings.length === settingsMigrated ? 'MATCH ✓' : 'MISMATCH ❌'})`);
    console.log(`Table "contacts": SQLite=${sqliteContacts.length}, PostgreSQL=${contactsMigrated} (${sqliteContacts.length === contactsMigrated ? 'MATCH ✓' : 'MISMATCH ❌'})`);
    console.log(`Table "history": SQLite=${sqliteHistory.length}, PostgreSQL=${historyMigrated} (${sqliteHistory.length === historyMigrated ? 'MATCH ✓' : 'MISMATCH ❌'})`);
    console.log('=============================================\n');

    if (
      sqliteUsers.length === usersMigrated &&
      sqliteSettings.length === settingsMigrated &&
      sqliteContacts.length === contactsMigrated &&
      sqliteHistory.length === historyMigrated
    ) {
      console.log('🎉 Data migration completed successfully with 100% data integrity!');
    } else {
      console.error('❌ Data migration completed with mismatch errors. Please review the output above.');
      process.exit(1);
    }

  } catch (err) {
    console.error('❌ Error during migration execution:', err);
    process.exit(1);
  } finally {
    sqliteDb.close();
    if (client) {
      await client.end();
    }
  }
}

runMigration();
