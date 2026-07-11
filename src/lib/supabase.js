/**
 * Supabase client singleton.
 * Reads config from Vite env vars.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Notebook] Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
  );
}

// Validate URL format
if (supabaseUrl && supabaseUrl.includes('/rest/v1')) {
  console.error(
    '[Notebook] VITE_SUPABASE_URL should NOT contain /rest/v1. Use: https://<project>.supabase.co',
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 5,
      },
    },
    // Global fetch options for better error handling
    global: {
      fetch: (...args) => {
        return fetch(...args).catch((err) => {
          console.error('[Notebook] Supabase fetch error:', err.message);
          throw err;
        });
      },
    },
  },
);

/** Check if Supabase is properly configured */
export function isConfigured() {
  return !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));
}

/** Test connection to Supabase */
export async function testConnection() {
  if (!isConfigured()) {
    return { ok: false, error: 'Not configured' };
  }
  try {
    const { error } = await supabase.from('entries').select('id').limit(1);
    if (error) {
      // PGRST116 = table not found (expected if schema not applied)
      // 42P01 = undefined table
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return { ok: true, error: null, note: 'Connected but schema not applied yet' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
