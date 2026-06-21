# SilentSOS - Womens Safety Platform

SilentSOS is a modern web application designed to facilitate real-time safety distress tracking, evidence collection (photos, video, and audio), and instant emergency notifications. 

The platform has been migrated permanently from SQLite to **PostgreSQL**.

---

## Tech Stack & Architecture

- **Frontend**: React, Vite, TailwindCSS, TypeScript
- **Backend**: Node.js, Express, WebSocket (ws)
- **Database**: PostgreSQL (Single source of truth)
- **Email Notifications**: Nodemailer (SMTP Gateway)

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A running PostgreSQL database instance (local or hosted, e.g., Neon / Supabase)

### Backend Configuration

1. Navigate to the `backend/` directory.
2. Create/update the `.env` file using the template in `.env.example`:
   
   ```env
   PORT=3001
   
   # SMTP Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   
   # PostgreSQL Configuration
   DATABASE_URL=postgresql://user:password@host:port/database_name?sslmode=require
   # OR individual connection details:
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=silentsos
   PGUSER=postgres
   PGPASSWORD=your_password
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```
   *Note: On server startup, the database schema (tables: `users`, `contacts`, `settings`, `history`) will be initialized automatically if they do not exist.*

### Frontend Configuration

1. Navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```

---

## Database Migration (SQLite to PostgreSQL)

If you are migrating existing data from an older SQLite installation:

1. Ensure your SQLite database file (`database.db`) is located at `backend/data/database.db`.
2. Configure your target PostgreSQL connection details in `backend/.env`.
3. Temporarily install the sqlite3 package:
   ```bash
   npm install sqlite3 --no-save
   ```
4. Run the programmatic migration script:
   ```bash
   node backend/migrate.js
   ```
5. Prune/remove the SQLite dependency when finished:
   ```bash
   npm uninstall sqlite3
   ```

---

## Database Schema (PostgreSQL)

The database schema is defined as:

### 1. `users` Table
Stores user profile information and credentials.
- `id` (VARCHAR PRIMARY KEY)
- `email` (VARCHAR UNIQUE)
- `password_hash` (VARCHAR)
- `name` (VARCHAR)
- `role` (VARCHAR)
- `disabled` (BOOLEAN DEFAULT FALSE)
- `is_setup_complete` (BOOLEAN DEFAULT FALSE)

### 2. `settings` Table
Stores notification, capture, and system preferences.
- `user_id` (VARCHAR PRIMARY KEY)
- `gesture_sensitivity` (VARCHAR)
- `auto_repeat_interval` (INTEGER)
- `photo_burst_count` (INTEGER)
- `video_duration` (VARCHAR)
- `audio_quality` (VARCHAR)
- `camera_preference` (VARCHAR)
- `fake_call_disguise` (BOOLEAN DEFAULT FALSE)
- `stealth_mode` (BOOLEAN DEFAULT FALSE)
- `message_template` (TEXT)
- `safety_pin` (VARCHAR)
- `auto_delete_days` (INTEGER)
- `global_emergency_emails` (TEXT)

### 3. `contacts` Table
Stores user emergency contacts.
- `id` (VARCHAR PRIMARY KEY)
- `user_id` (VARCHAR REFERENCES users(id) ON DELETE CASCADE)
- `name` (VARCHAR)
- `phone_enc` (TEXT) - Encrypted using AES-256-CBC
- `email_enc` (TEXT) - Encrypted using AES-256-CBC
- `preferences` (JSONB) - Channel notification preferences

### 4. `history` Table
Stores recorded distress alerts and attached evidence.
- `id` (VARCHAR PRIMARY KEY)
- `user_id` (VARCHAR)
- `timestamp` (BIGINT) - Unix epoch millisecond timestamp
- `type` (VARCHAR)
- `duration_seconds` (INTEGER)
- `status` (VARCHAR)
- `evidence` (JSONB) - Evidence counts and list of file links
- `contacts_notified` (JSONB) - Logs of message channels notified
- `gps_path_enc` (TEXT) - Encrypted JSON tracking coordinates

---

## PostgreSQL Backup and Restore Commands

### Backup (Dump) Database
To create a complete backup of your database:
```bash
pg_dump -U <username> -h <host> -p <port> -d <database_name> -F c -b -v -f silentsos_backup.dump
```
If using a connection URL:
```bash
pg_dump "postgresql://user:password@host:port/database_name?sslmode=require" -F c -b -v -f silentsos_backup.dump
```

### Restore Database
To restore the backup into a clean database:
```bash
pg_restore -U <username> -h <host> -p <port> -d <database_name> -c --if-exists -v silentsos_backup.dump
```
If using a connection URL:
```bash
pg_restore --clean --if-exists -d "postgresql://user:password@host:port/database_name?sslmode=require" -v silentsos_backup.dump
```
