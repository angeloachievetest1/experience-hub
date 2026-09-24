import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from './env';

// Full-access Supabase client using the secret (service role) key.
// Server code only: creating users, setting passwords, deleting users.
// `server-only` makes the build fail if this is ever imported by browser code.
export function createAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local (Supabase → Project Settings → API Keys → Secret key).');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
