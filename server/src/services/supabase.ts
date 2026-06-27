import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('WARNING: Supabase URL or Anon Key is missing in server environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
