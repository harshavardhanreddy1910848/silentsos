import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ENCRYPTION_KEY = crypto.scryptSync('silentsos-womens-safety-secret-salt-key-2026', 'salt', 32);
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
    return text;
  }
}

async function main() {
  try {
    // 1. Get the absolute last alert in history
    const historyRes = await pool.query('SELECT * FROM history ORDER BY timestamp DESC LIMIT 1');
    if (historyRes.rows.length === 0) {
      console.log('❌ No alerts found in database.');
      return;
    }
    const lastAlert = historyRes.rows[0];
    console.log('\n=== LAST DISTRESS ALERT ===');
    console.log({
      id: lastAlert.id,
      user_id: lastAlert.user_id,
      timestamp: new Date(Number(lastAlert.timestamp)).toISOString(),
      type: lastAlert.type,
      status: lastAlert.status
    });

    // 2. Get user info
    const userRes = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [lastAlert.user_id]);
    if (userRes.rows.length === 0) {
      console.log('❌ User not found for this alert.');
      return;
    }
    const user = userRes.rows[0];
    console.log('\n=== SENDER USER ===');
    console.log(user);

    // 3. Get contacts for this user
    const contactsRes = await pool.query('SELECT id, name, email_enc, preferences FROM contacts WHERE user_id = $1', [lastAlert.user_id]);
    console.log('\n=== REGISTERED CONTACTS FOR USER ===');
    const contacts = contactsRes.rows.map(c => ({
      id: c.id,
      name: c.name,
      email: decrypt(c.email_enc),
      preferences: c.preferences
    }));
    console.log(contacts);

  } catch (err) {
    console.error('Error running diagnostics:', err);
  } finally {
    await pool.end();
  }
}

main();
