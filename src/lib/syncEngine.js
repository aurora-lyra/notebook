/**
 * Sync Engine — local-first + cloud merge with conflict resolution.
 *
 * Strategy:
 *   1. All reads/writes hit localStorage first (instant UX)
 *   2. Changes are queued and pushed to Supabase in batches
 *   3. Remote changes are pulled and merged into local
 *   4. Conflict resolution: last-write-wins (updated_at), version as tiebreaker
 *   5. Realtime subscription for live cross-device updates
 */

import { supabase, isConfigured } from './supabase';
import { invalidateCache } from './db';

const PUSH_DEBOUNCE = 800; // ms before pushing changes
const PUSH_ECHO_GRACE = 2500; // ms to suppress Realtime echo after push
const PENDING_DELETIONS_KEY = 'notebook_pending_deletions';
let pushTimer = null;
let currentUserId = null;
let lastPushTime = 0; // timestamp of last completed push

/* ============================================================
   Pending deletions tracking
   ============================================================ */

function readPendingDeletions() {
  try {
    const raw = localStorage.getItem(PENDING_DELETIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writePendingDeletions(set) {
  localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify([...set]));
}

/** Register an entry ID for deferred cloud deletion. */
export function queueDeletion(id) {
  const pending = readPendingDeletions();
  pending.add(id);
  writePendingDeletions(pending);
}

/** Clear a successfully-deleted ID from the pending set. */
function clearPendingDeletion(id) {
  const pending = readPendingDeletions();
  pending.delete(id);
  writePendingDeletions(pending);
}

/* ============================================================
   Naming convention helpers
   Local (camelCase) <-> Remote (snake_case)
   ============================================================ */

function entryToRemote(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    title: entry.title,
    content: entry.content,
    type: entry.type,
    mode: entry.mode || 'text',
    todos: entry.todos || [],
    status: entry.status || 'draft',
    mood: entry.mood || null,
    weather: entry.weather || null,
    tags: entry.tags,
    folder: entry.folder,
    pinned: entry.pinned,
    favorited: entry.favorited,
    cover_url: entry.coverUrl,
    reminder_at: entry.reminderAt,
    related_ids: entry.relatedIds,
    attachments: entry.attachments,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function entryFromRemote(row) {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content,
    type: row.type,
    mode: row.mode || 'text',
    todos: row.todos || [],
    status: row.status || 'draft',
    mood: row.mood || null,
    weather: row.weather || null,
    tags: row.tags || [],
    folder: row.folder || '',
    pinned: row.pinned || false,
    favorited: row.favorited || false,
    coverUrl: row.cover_url || '',
    reminderAt: row.reminder_at,
    relatedIds: row.related_ids || [],
    attachments: row.attachments || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function todoToRemote(todo, userId) {
  return {
    id: todo.id,
    user_id: userId,
    text: todo.text,
    done: todo.done,
    priority: todo.priority,
    due_at: todo.dueAt,
    reminded_at: todo.remindedAt,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
  };
}

function todoFromRemote(row) {
  return {
    id: row.id,
    text: row.text || '',
    done: row.done || false,
    priority: row.priority || 'medium',
    dueAt: row.due_at,
    remindedAt: row.reminded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ============================================================
   Local storage helpers (reuse existing keys)
   ============================================================ */

function readLocalEntries() {
  try {
    return JSON.parse(localStorage.getItem('notebook_entries')) || [];
  } catch {
    return [];
  }
}

function writeLocalEntries(entries) {
  localStorage.setItem('notebook_entries', JSON.stringify(entries));
  invalidateCache(); // Tell db.js to re-read from localStorage next time
}

function readLocalTodos() {
  try {
    return JSON.parse(localStorage.getItem('notebook_todos')) || [];
  } catch {
    return [];
  }
}

function writeLocalTodos(todos) {
  localStorage.setItem('notebook_todos', JSON.stringify(todos));
}

/* ============================================================
   Conflict resolution: last-write-wins
   ============================================================ */

function resolveConflict(local, remote) {
  const localTime = new Date(local.updatedAt || local.updated_at).getTime();
  const remoteTime = new Date(remote.updatedAt || remote.updated_at).getTime();

  // Remote is newer → use remote
  if (remoteTime > localTime) return 'remote';
  // Local is newer → use local
  if (localTime > remoteTime) return 'local';
  // Same timestamp → use higher version (remote, since server increments)
  return 'remote';
}

/* ============================================================
   Push: send local changes to Supabase
   ============================================================ */

async function pushEntries(userId) {
  if (!isConfigured()) return;

  // ─── Step 1: Push pending deletions ───
  const pending = readPendingDeletions();
  if (pending.size > 0) {
    const idsToDelete = [...pending];
    console.log('[Sync] Attempting cloud delete:', {
      userId,
      idsToDelete,
      pendingCount: idsToDelete.length,
    });

    const { data: deletedRows, error: deleteError, status, statusText } = await supabase
      .from('entries')
      .delete()
      .eq('user_id', userId)
      .in('id', idsToDelete)
      .select('id');

    // Detailed error logging
    if (deleteError) {
      console.error('[Sync] ❌ Cloud delete FAILED:', {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        httpStatus: status,
        httpStatusText: statusText,
      });
      // Keep in pending — will retry on next sync
    } else {
      const deletedIds = new Set((deletedRows || []).map((r) => r.id));
      const notDeleted = idsToDelete.filter((id) => !deletedIds.has(id));

      if (notDeleted.length > 0) {
        console.warn('[Sync] ⚠️ Some IDs were NOT found on server (0 rows affected):', {
          notDeleted,
          possibleCauses: [
            'RLS DELETE policy missing or incorrect',
            'Entry was never synced to cloud',
            'Entry already deleted by another device',
          ],
        });
      }

      for (const id of idsToDelete) {
        if (deletedIds.has(id)) {
          console.log('[Sync] ✅ Deleted from cloud:', id);
        } else {
          console.log('[Sync] ⏭️ ID not on server, clearing from pending:', id);
        }
        clearPendingDeletion(id);
      }
    }
  }

  // ─── Step 2: Upsert remaining local entries (published only) ───
  const locals = readLocalEntries();
  if (locals.length === 0) return;

  // Get remote entries to compare
  const { data: remotes, error: fetchError } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId);

  if (fetchError) {
    console.error('[Sync] Failed to fetch remote entries:', fetchError);
    return;
  }

  const remoteMap = new Map((remotes || []).map((r) => [r.id, r]));
  const toUpsert = [];

  for (const local of locals) {
    // Only push published entries — drafts stay local
    if ((local.status || 'draft') === 'draft') continue;

    const remote = remoteMap.get(local.id);
    if (!remote) {
      toUpsert.push(entryToRemote(local, userId));
    } else {
      const winner = resolveConflict(local, entryFromRemote(remote));
      if (winner === 'local') {
        toUpsert.push(entryToRemote(local, userId));
      }
    }
  }

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('entries')
      .upsert(toUpsert, { onConflict: 'id' });
    if (upsertError) {
      console.error('[Sync] Cloud upsert failed:', upsertError);
      throw upsertError;
    }
  }
}

async function pushTodos(userId) {
  if (!isConfigured()) return;

  const locals = readLocalTodos();
  if (locals.length === 0) return;

  const { data: remotes, error: fetchError } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId);

  if (fetchError) {
    console.error('[Sync] Failed to fetch remote todos:', fetchError);
    return;
  }

  const remoteMap = new Map((remotes || []).map((r) => [r.id, r]));
  const toUpsert = [];

  for (const local of locals) {
    const remote = remoteMap.get(local.id);
    if (!remote) {
      toUpsert.push(todoToRemote(local, userId));
    } else {
      const winner = resolveConflict(local, todoFromRemote(remote));
      if (winner === 'local') {
        toUpsert.push(todoToRemote(local, userId));
      }
    }
  }

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('todos')
      .upsert(toUpsert, { onConflict: 'id' });
    if (upsertError) {
      console.error('[Sync] Todos upsert failed:', upsertError);
      throw upsertError;
    }
  }
}

/* ============================================================
   Pull: fetch remote changes and merge into local
   ============================================================ */

async function pullEntries(userId) {
  if (!isConfigured()) return;

  const { data: remotes, error: fetchError } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId);

  if (fetchError) {
    console.error('[Sync] Failed to pull entries:', fetchError);
    return;
  }
  if (!remotes) return;

  // Filter out entries that are pending deletion
  const pending = readPendingDeletions();
  const locals = readLocalEntries();
  const localMap = new Map(locals.map((l) => [l.id, l]));
  const merged = [];

  for (const remote of remotes) {
    // Skip entries that we've locally deleted but haven't synced yet
    if (pending.has(remote.id)) continue;

    const local = localMap.get(remote.id);
    const remoteEntry = entryFromRemote(remote);

    if (!local) {
      // New from remote → add to local
      merged.push(remoteEntry);
    } else {
      // Exists on both → keep the winner
      const winner = resolveConflict(local, remoteEntry);
      merged.push(winner === 'remote' ? remoteEntry : local);
    }
  }

  // Keep local-only entries that weren't in remote (pending push)
  for (const local of locals) {
    if (!remotes.find((r) => r.id === local.id)) {
      merged.push(local);
    }
  }

  writeLocalEntries(merged);
  return merged;
}

async function pullTodos(userId) {
  if (!isConfigured()) return;

  const { data: remotes, error: fetchError } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId);

  if (fetchError) {
    console.error('[Sync] Failed to pull todos:', fetchError);
    return;
  }
  if (!remotes) return;

  const locals = readLocalTodos();
  const localMap = new Map(locals.map((l) => [l.id, l]));
  const merged = [];

  for (const remote of remotes) {
    const local = localMap.get(remote.id);
    const remoteTodo = todoFromRemote(remote);

    if (!local) {
      merged.push(remoteTodo);
    } else {
      const winner = resolveConflict(local, remoteTodo);
      merged.push(winner === 'remote' ? remoteTodo : local);
    }
  }

  for (const local of locals) {
    if (!remotes.find((r) => r.id === local.id)) {
      merged.push(local);
    }
  }

  writeLocalTodos(merged);
  return merged;
}

/* ============================================================
   Public API
   ============================================================ */

/**
 * Initialize sync for a user. Call on login.
 * Does initial pull, then sets up Realtime.
 */
export async function initSync(userId) {
  currentUserId = userId;
  if (!isConfigured()) return { entries: readLocalEntries(), todos: readLocalTodos() };

  let entries, todos;

  // Initial full pull (ignore errors — local data is still valid)
  try {
    entries = await pullEntries(userId);
  } catch (err) {
    console.error('[Sync] Pull entries failed:', err);
  }
  try {
    todos = await pullTodos(userId);
  } catch (err) {
    console.error('[Sync] Pull todos failed:', err);
  }

  // Push any local-only items (ignore errors — will retry on next sync)
  try {
    await pushEntries(userId);
  } catch (err) {
    console.error('[Sync] Push entries failed:', err);
  }
  try {
    await pushTodos(userId);
  } catch (err) {
    console.error('[Sync] Push todos failed:', err);
  }

  return { entries: entries || readLocalEntries(), todos: todos || readLocalTodos() };
}

/**
 * Teardown sync. Call on logout.
 */
export function teardownSync() {
  currentUserId = null;
  clearPushTimer();
  unsubscribeAll();
}

/**
 * Schedule a push of local changes. Debounced.
 */
export function schedulePush() {
  if (!currentUserId || !isConfigured()) return;

  clearPushTimer();
  pushTimer = setTimeout(async () => {
    try {
      await pushEntries(currentUserId);
      await pushTodos(currentUserId);
      lastPushTime = Date.now();
    } catch (err) {
      console.error('[Sync] Push failed:', err);
    }
  }, PUSH_DEBOUNCE);
}

function clearPushTimer() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

/**
 * Full sync: push then pull. Call on tab focus.
 */
export async function fullSync() {
  if (!currentUserId || !isConfigured()) return;

  try {
    await pushEntries(currentUserId);
    await pushTodos(currentUserId);
    lastPushTime = Date.now();
    await pullEntries(currentUserId);
    await pullTodos(currentUserId);
  } catch (err) {
    console.error('[Sync] Full sync failed:', err);
  }
}

/**
 * Push all local entries to cloud immediately (no debounce).
 * Used for batch upload from settings.
 */
export async function pushAll() {
  if (!currentUserId || !isConfigured()) {
    throw new Error('未配置云端或未登录');
  }

  clearPushTimer();
  await pushEntries(currentUserId);
  await pushTodos(currentUserId);
  lastPushTime = Date.now();
}

/* ============================================================
   Realtime subscriptions
   ============================================================ */

let entryChannel = null;
let todoChannel = null;
let onChangeCallback = null;

/**
 * Subscribe to realtime changes.
 * `onChange` is called when a remote change is detected.
 */
export function subscribeRealtime(userId, onChange) {
  if (!isConfigured()) return;
  unsubscribeAll();
  onChangeCallback = onChange;

  // Subscribe to entries changes
  entryChannel = supabase
    .channel('entries-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'entries',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        // Skip echo: if we just pushed, this is likely our own change bouncing back
        if (Date.now() - lastPushTime < PUSH_ECHO_GRACE) return;
        console.log('[Realtime] entries change:', payload.eventType);
        await pullEntries(userId);
        onChangeCallback?.('entries');
      },
    )
    .subscribe();

  // Subscribe to todos changes
  todoChannel = supabase
    .channel('todos-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'todos',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        // Skip echo: if we just pushed, this is likely our own change bouncing back
        if (Date.now() - lastPushTime < PUSH_ECHO_GRACE) return;
        console.log('[Realtime] todos change:', payload.eventType);
        await pullTodos(userId);
        onChangeCallback?.('todos');
      },
    )
    .subscribe();
}

function unsubscribeAll() {
  if (entryChannel) {
    supabase.removeChannel(entryChannel);
    entryChannel = null;
  }
  if (todoChannel) {
    supabase.removeChannel(todoChannel);
    todoChannel = null;
  }
  onChangeCallback = null;
}
