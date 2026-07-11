import { useState, useEffect, useCallback } from 'react';
import { supabase, isConfigured, testConnection } from '../lib/supabase';

/**
 * Auth hook — manages Supabase auth state.
 * Returns { user, loading, signIn, signUp, signOut, isConfigured, connectionError }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  // Get initial session with timeout
  useEffect(() => {
    if (!isConfigured()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Set a timeout — if Supabase doesn't respond in 10s, proceed without auth
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('[Notebook] Supabase connection timeout — falling back to local mode');
        setConnectionError('连接超时，请检查网络');
        setLoading(false);
      }
    }, 10000);

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);

        if (error) {
          console.error('[Notebook] Auth error:', error.message);
          setConnectionError(error.message);
        } else {
          setUser(session?.user ?? null);
          setConnectionError(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeout);
        console.error('[Notebook] Supabase connection failed:', err.message);
        setConnectionError(err.message);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
        setConnectionError(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setConnectionError(null);
      return data.user;
    } catch (err) {
      // Enhance network error messages
      if (err.message === 'Failed to fetch') {
        throw new Error('网络连接失败，请检查网络或 VPN 设置');
      }
      throw err;
    }
  }, []);

  const signUp = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      setConnectionError(null);
      return data.user;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('网络连接失败，请检查网络或 VPN 设置');
      }
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }, []);

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isSupabaseConfigured: isConfigured(),
    connectionError,
  };
}
