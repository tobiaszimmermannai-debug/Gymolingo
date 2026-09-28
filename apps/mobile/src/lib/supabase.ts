/**
 * Supabase client. Configured via public env vars (the anon/publishable key is
 * designed to be public – all data access is protected by Row Level Security).
 * Without configuration the app runs fully offline in local mode.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { kv } from '@/data/kv';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isBackendConfigured = !!(url && anonKey);

const authStorage = {
  getItem: (k: string) => kv.get(`sb:${k}`),
  setItem: (k: string, v: string) => kv.set(`sb:${k}`, v),
  removeItem: (k: string) => kv.remove(`sb:${k}`),
};

export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const backendUrl = url;
