/**
 * Local storage data layer for Notebook.
 * Uses an in-memory cache to avoid redundant JSON.parse on every operation.
 *
 * Data model:
 *   - id, title, content (TipTap JSON), type ('diary' | 'memo')
 *   - tags[], folder, pinned, favorited, coverUrl
 *   - reminderAt, relatedIds[], attachments[]
 *   - createdAt, updatedAt
 */

const STORAGE_KEY = 'notebook_entries';

/* ---- In-memory cache ---- */

let _cache = null;
let _dirty = true;

function loadCache() {
  if (_dirty || !_cache) {
    try {
      _cache = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      _cache = [];
    }
    _dirty = false;
  }
  return _cache;
}

function flushCache() {
  // MUST be synchronous — async writes (requestIdleCallback) cause a race:
  //   1. deleteEntry() removes from in-memory cache
  //   2. flushCache() SCHEDULES a write (but hasn't written yet!)
  //   3. queueDeletion() writes pending ID
  //   4. pushEntries() reads localStorage → sees OLD data → re-upserts deleted entry
  // Synchronous write eliminates this race entirely.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Force cache refresh from localStorage (e.g. after remote sync) */
export function invalidateCache() {
  _dirty = true;
}

/* ---- CRUD ---- */

/**
 * List entries from cache. Optional filter: { type, tag, folder, search }
 * Returns a NEW array (sorted) — safe for React state.
 */
export function listEntries(filter = {}) {
  let entries = loadCache();

  if (filter.type) entries = entries.filter((e) => e.type === filter.type);
  if (filter.status) entries = entries.filter((e) => (e.status || 'draft') === filter.status);
  if (filter.tag) entries = entries.filter((e) => e.tags.includes(filter.tag));
  if (filter.folder) entries = entries.filter((e) => e.folder === filter.folder);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.content && JSON.stringify(e.content).toLowerCase().includes(q)) ||
        (e.todos && e.todos.some((t) => t.text.toLowerCase().includes(q))),
    );
  }

  // pinned first, then by updatedAt desc
  return [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

/** Get a single entry by id (from cache) */
export function getEntry(id) {
  return loadCache().find((e) => e.id === id) || null;
}

/** Create a new entry */
export function createEntry(overrides = {}) {
  const now = new Date().toISOString();
  const entry = {
    id: uid(),
    title: '',
    content: null,
    type: 'memo',
    tags: [],
    folder: '',
    pinned: false,
    favorited: false,
    coverUrl: '',
    mode: 'text',
    todos: [],
    status: 'draft',
    mood: null,
    weather: null,
    reminderAt: null,
    relatedIds: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  loadCache().push(entry);
  flushCache();
  return entry;
}

/** Update an existing entry (partial patch). Mutates cache in-place. */
export function updateEntry(id, patch) {
  const entries = loadCache();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  entries[idx] = {
    ...entries[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  flushCache();
  return entries[idx];
}

/**
 * Delete an entry by id.
 * Returns the deleted entry (or null if not found).
 */
export function deleteEntry(id) {
  const entries = loadCache();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const [deleted] = entries.splice(idx, 1);
  flushCache();
  return deleted;
}

/**
 * Restore a previously deleted entry (rollback).
 * Pushes it back into the cache and flushes to localStorage.
 */
export function restoreEntry(entry) {
  if (!entry) return;
  loadCache().push(entry);
  flushCache();
}

/* ---- Draft localStorage (instant local save) ---- */

function draftKey(entryId) {
  return `draft_entry_${entryId}`;
}

/** Save a draft field to localStorage (instant, 0ms). */
export function saveDraftLocal(entryId, patch) {
  try {
    const existing = JSON.parse(localStorage.getItem(draftKey(entryId))) || {};
    const merged = { ...existing, ...patch, _updatedAt: Date.now() };
    localStorage.setItem(draftKey(entryId), JSON.stringify(merged));
  } catch { /* ignore quota errors */ }
}

/** Read a draft from localStorage. */
export function readDraftLocal(entryId) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(entryId))) || null;
  } catch {
    return null;
  }
}

/** Clear a draft from localStorage after publishing. */
export function clearDraftLocal(entryId) {
  localStorage.removeItem(draftKey(entryId));
}

/* ---- Tags & Folders (derived from cache) ---- */

/** Get all unique tags across entries */
export function getAllTags() {
  const set = new Set();
  loadCache().forEach((e) => e.tags.forEach((t) => set.add(t)));
  return [...set].sort();
}

/** Get all unique folders */
export function getAllFolders() {
  const set = new Set();
  loadCache().forEach((e) => {
    if (e.folder) set.add(e.folder);
  });
  return [...set].sort();
}
