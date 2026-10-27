-- ============================================================
-- SilentSOS Emergency Alert System - Supabase Database Schema
-- Execute this SQL in your Supabase SQL Editor to set up tables
-- ============================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  address TEXT DEFAULT '',
  parents_name TEXT DEFAULT '',
  blood_group TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  gesture TEXT NOT NULL DEFAULT 'camera-gesture',
  permissions JSONB NOT NULL DEFAULT '{"camera": false, "microphone": false, "location": false, "storage": false}'::jsonb,
  authenticated BOOLEAN NOT NULL DEFAULT true,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  prefs JSONB NOT NULL DEFAULT '{"gps": true, "photos": true, "video": true, "audio": true, "message": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  sensitivity TEXT NOT NULL DEFAULT 'medium',
  auto_repeat INT NOT NULL DEFAULT 5,
  burst_count INT NOT NULL DEFAULT 5,
  video_duration TEXT NOT NULL DEFAULT '1min',
  audio_quality TEXT NOT NULL DEFAULT 'high',
  camera_choice TEXT NOT NULL DEFAULT 'both',
  discreet BOOLEAN NOT NULL DEFAULT false,
  message_template TEXT NOT NULL DEFAULT '🚨 EMERGENCY ALERT — SilentSOS\nI need help. My live location and evidence are attached. Please respond immediately or call emergency services.',
  auto_delete_days INT NOT NULL DEFAULT 14,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'sos', -- 'sos' | 'medical' | 'fire' | 'police' | 'danger'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- 'sent' | 'cancelled' | 'failed' | 'partial' | 'active'
  gps_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_count INT NOT NULL DEFAULT 0,
  video_count INT NOT NULL DEFAULT 0,
  audio_count INT NOT NULL DEFAULT 0,
  deliveries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. EVIDENCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'photo' | 'video' | 'audio'
  url TEXT NOT NULL,
  file_size INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'feedback', -- 'feedback' | 'bug' | 'help'
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR FAST SEARCH
CREATE INDEX IF NOT EXISTS idx_contacts_profile ON public.contacts(profile_id);
CREATE INDEX IF NOT EXISTS idx_alerts_profile ON public.alerts(profile_id);
CREATE INDEX IF NOT EXISTS idx_evidence_alert ON public.evidence_records(alert_id);
CREATE INDEX IF NOT EXISTS idx_feedback_profile ON public.feedback(profile_id);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- OPEN ACCESS POLICIES FOR ANONYMOUS/SERVICE ROLE DEPLOYMENTS
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public write profiles" ON public.profiles FOR ALL USING (true);

CREATE POLICY "Allow public read contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Allow public write contacts" ON public.contacts FOR ALL USING (true);

CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow public write settings" ON public.settings FOR ALL USING (true);

CREATE POLICY "Allow public read alerts" ON public.alerts FOR SELECT USING (true);
CREATE POLICY "Allow public write alerts" ON public.alerts FOR ALL USING (true);

CREATE POLICY "Allow public read evidence" ON public.evidence_records FOR SELECT USING (true);
CREATE POLICY "Allow public write evidence" ON public.evidence_records FOR ALL USING (true);

CREATE POLICY "Allow public read feedback" ON public.feedback FOR SELECT USING (true);
CREATE POLICY "Allow public write feedback" ON public.feedback FOR ALL USING (true);


-- ============================================================
-- 7. SUPABASE STORAGE BUCKET & POLICIES FOR "app-files"
-- ============================================================

-- Create storage bucket named "app-files" if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-files', 'app-files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies for app-files if re-running
DROP POLICY IF EXISTS "Public Read app-files" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert app-files" ON storage.objects;
DROP POLICY IF EXISTS "Public Update app-files" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete app-files" ON storage.objects;

-- 1. SELECT / DOWNLOAD Policy: Allow reading files from "app-files" bucket
CREATE POLICY "Public Read app-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-files');

-- 2. INSERT / UPLOAD Policy: Allow uploading files to "app-files" bucket
CREATE POLICY "Public Insert app-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'app-files');

-- 3. UPDATE Policy: Allow updating files in "app-files" bucket
CREATE POLICY "Public Update app-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'app-files');

-- 4. DELETE Policy: Allow deleting files from "app-files" bucket
CREATE POLICY "Public Delete app-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'app-files');
