import { useState, useCallback, useEffect, useRef } from 'react';
import * as db from '../lib/db';
import { queueDeletion } from '../lib/syncEngine';

/**
 * Apply filter + sort to an entries array.
 * Reused by both listEntries path and the optimized remove path.
 */
function applyFilter(entries, filter) {
  let result = entries;
  if (filter.type) result = result.filter((e) => e.type === filter.type);
  if (filter.status) result = result.filter((e) => (e.status || 'draft') === filter.status);
  if (filter.tag) result = result.filter((e) => e.tags.includes(filter.tag));
  if (filter.folder) result = result.filter((e) => e.folder === filter.folder);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.content && JSON.stringify(e.content).toLowerCase().includes(q)) ||
        (e.todos && e.todos.some((t) => t.text.toLowerCase().includes(q))),
    );
  }
  return [...result].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

/**
 * Hook for managing notebook entries with local state sync.
 * @param filter - query filter object
 * @param syncVersion - increment to force re-read (triggers on remote sync)
 */
export function useEntries(filter = {}, syncVersion = 0) {
  const [entries, setEntries] = useState(() => db.listEntries(filter));
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const refresh = useCallback(() => {
    setEntries(db.listEntries(filterRef.current));
  }, []);

  // Re-read when syncVersion changes (remote data arrived)
  useEffect(() => {
    refresh();
  }, [syncVersion, refresh]);

  const create = useCallback(
    (overrides) => {
      const entry = db.createEntry(overrides);
      // Optimistic: append to current list instead of full re-read
      setEntries((prev) =>
        applyFilter([...prev, entry], filterRef.current),
      );
      return entry;
    },
    [],
  );

  const update = useCallback(
    (id, patch) => {
      const updated = db.updateEntry(id, patch);
      if (!updated) return null;
      // Optimistic: replace in-place
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? updated : e)),
      );
      return updated;
    },
    [],
  );

  const remove = useCallback(
    (id) => {
      // Capture the entry BEFORE deleting (for potential rollback)
      const deletedEntry = db.getEntry(id);
      // Optimistic: remove from UI immediately via prev.filter
      // db.deleteEntry mutates the cache + flushes to localStorage (side effect)
      db.deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      // Register for cloud deletion (will be picked up by next sync push)
      queueDeletion(id);
      // Return the deleted entry so callers can rollback on failure
      return deletedEntry;
    },
    [],
  );

  const restore = useCallback(
    (entry) => {
      if (!entry) return;
      // Push back into localStorage cache
      db.restoreEntry(entry);
      // Re-insert into UI state
      setEntries((prev) =>
        applyFilter([...prev, entry], filterRef.current),
      );
    },
    [],
  );

  /** Batch delete multiple entries. Returns deleted entries for rollback. */
  const batchRemove = useCallback(
    (ids) => {
      const deleted = [];
      for (const id of ids) {
        const entry = db.getEntry(id);
        if (entry) {
          db.deleteEntry(id);
          queueDeletion(id);
          deleted.push(entry);
        }
      }
      setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
      return deleted;
    },
    [],
  );

  return { entries, create, update, remove, restore, batchRemove, refresh };
}

/**
 * Hook for a single entry with auto-save.
 * @param id - entry id
 * @param syncVersion - increment to force re-read
 */
export function useEntry(id, syncVersion = 0) {
  const [entry, setEntry] = useState(() => (id ? db.getEntry(id) : null));

  const reload = useCallback(() => {
    if (id) setEntry(db.getEntry(id));
  }, [id]);

  useEffect(() => {
    reload();
  }, [syncVersion, reload]);

  const save = useCallback(
    (patch) => {
      if (!id) return null;
      const updated = db.updateEntry(id, patch);
      setEntry(updated);
      return updated;
    },
    [id],
  );

  return { entry, save, reload };
}
