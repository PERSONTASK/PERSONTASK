import { createClient } from '@supabase/supabase-js';

// Centralized Supabase client. Reads public keys from Vite env (see .env.example).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev so misconfiguration is obvious.
  // eslint-disable-next-line no-console
  console.error(
    'PERSONTASK: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env (veja .env.example).',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

// Storage bucket names (mirrors supabase/schema.sql)
export const BUCKETS = {
  attachments: 'attachments',
  avatars: 'avatars',
  spaceBackgrounds: 'space-backgrounds',
} as const;
