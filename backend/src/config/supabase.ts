import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://viyqvpvubngpsyfhjmbj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_cGDXTSgCLS1NyYJZRE20tw_6aUrX9c-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
