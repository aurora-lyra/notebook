import { useEffect, useCallback, useRef } from 'react';
import {
  initSync,
  teardownSync,
  schedulePush,
  fullSync,
  subscribeRealtime,
} from '../lib/syncEngine';

/**
 * Sync hook — integrates the sync engine with the app lifecycle.
 *
 * Call with the current user (null = logged out).
 * Returns { onLocalChange } to call after every local write.
 */
export function useSync(user, onRemoteChange) {
  const initialized = useRef(false);
  const onRemoteChangeRef = useRef(onRemoteChange);
  const cancelRef = useRef(false);

  // Keep callback ref fresh
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  // Init sync on login, teardown on logout
  useEffect(() => {
    if (!user) {
      teardownSync();
      initialized.current = false;
      return;
    }

    if (initialized.current) return;
    initialized.current = true;
    cancelRef.current = false;

    (async () => {
      try {
        await initSync(user.id);
      } catch (err) {
        console.error('[Sync] Init failed:', err);
      }
      // Guard: user may have changed during async init
      if (cancelRef.current) return;
      // Always subscribe realtime, even if initSync failed
      subscribeRealtime(user.id, (table) => {
        onRemoteChangeRef.current?.(table);
      });
    })();

    return () => {
      cancelRef.current = true;
    };
  }, [user]);

  // Full sync on tab focus (fallback for Realtime gaps)
  useEffect(() => {
    if (!user) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fullSync().then(() => {
          onRemoteChangeRef.current?.('all');
        }).catch((err) => {
          console.error('[Sync] Full sync failed:', err);
        });
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    return () => window.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  // Call this after every local write to schedule a cloud push
  const onLocalChange = useCallback(() => {
    schedulePush();
  }, []);

  return { onLocalChange };
}
