# SilentSOS - Women's Safety Platform

SilentSOS is a comprehensive personal safety and emergency distress response platform designed to facilitate real-time safety distress tracking, evidence collection (photos, video, and audio), and instant emergency notifications to trusted contacts.

---

## 🚀 Tech Stack & Architecture

- **Monorepo Architecture**: Managed via npm workspaces (`frontend`, `backend`)
- **Frontend**: 
  - React 18, Vite, TypeScript, TailwindCSS
  - Framer Motion, Lucide React
  - Google Maps JavaScript API for real-time tracking
  - Supabase Client for authentication and state synchronization
  - Gesture recognition and discreet trigger overlays (Fake Call, discreet UI)
- **Backend**:
  - Node.js, Express 5, TypeScript, TSX
  - Supabase PostgreSQL (Single source of truth)
  - Resend API for instant emergency email alerts
  - Express Rate Limiting & Secure CORS configuration
- **Android Support**:
  - Native Kotlin Android wrapper with custom WebViewClient and WebChromeClient

---

## 📁 Repository Structure

```text
├── backend/                  # Express + TypeScript backend API
│   ├── src/
│   │   ├── config/           # Supabase & environment config
│   │   ├── middleware/       # Rate limiting & security middlewares
│   │   ├── routes/           # Express REST endpoints (alerts, contacts, settings, etc.)
│   │   ├── services/         # Resend email service & integrations
│   │   ├── types/            # TypeScript definitions
│   │   └── server.ts         # Main server entrypoint
│   ├── schema.sql            # PostgreSQL / Supabase database schema
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # Vite + React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # UI components, Google Maps view, discreet overlays
│   │   ├── context/          # Global application state (AppContext)
│   │   ├── hooks/            # GPS tracking, voice trigger, live alert hooks
│   │   ├── lib/              # API helpers, Supabase client, gesture engine
│   │   └── pages/            # App screens (Home, AlertTrigger, Evidence, Settings, Contacts, etc.)
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── android/                  # Native Android application
├── package.json              # Monorepo root configuration & scripts
└── tsconfig.json             # Root TypeScript project references
```

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm (v9+ recommended)
- Supabase account & project
- Resend API key (for emergency email notifications)
- Google Maps API key (for live tracking)

### 1. Installation

Install all dependencies across the entire monorepo using npm workspaces:

```bash
npm install
```

### 2. Environment Setup

#### Backend Configuration
Copy `.env.example` to `.env` in the `backend/` folder:

```bash
cp backend/.env.example backend/.env
```

Fill in your configuration:
```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=SilentSOS Emergency Alert <onboarding@resend.dev>
```

#### Frontend Configuration
Copy `.env.example` to `.env` in the `frontend/` folder:

```bash
cp frontend/.env.example frontend/.env
```

Fill in your frontend configuration:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### 3. Database Schema Setup

Execute the SQL script located at `backend/schema.sql` inside your Supabase SQL Editor to initialize:
- `users`, `contacts`, `alerts`, `evidence`, and `settings` tables.
- Row-Level Security (RLS) policies and performance indexes.

### 4. Running Locally

Run both frontend and backend concurrently from the root directory:

```bash
npm run dev
```

Or run them individually:
```bash
npm run server        # Starts the backend API on http://localhost:5000
npm run dev:frontend  # Starts the Vite development server on http://localhost:5173
```

### 5. Production Build

Build both workspaces:
```bash
npm run build
```

---

## 🔐 Security & Privacy

- All emergency contact information and location coordinates are protected with Supabase Row Level Security (RLS).
- Discreet trigger options include volume button gesture sequences, shake detection, and a realistic Fake Incoming Call disguise.
- Automated rate limiting mitigates denial-of-service and API abuse.
