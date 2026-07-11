/**
 * Todo data layer for the Memo module.
 *
 * Schema:
 *   - id, text, done, priority ('high' | 'medium' | 'low')
 *   - dueAt: ISO string | null  (deadline)
 *   - remindedAt: ISO string | null  (track if reminder was sent)
 *   - sortOrder: number (lower = higher position, auto-assigned on creation)
 *   - createdAt, updatedAt
 */

const STORAGE_KEY = 'notebook_todos';

/* ---- helpers ---- */

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeAll(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---- CRUD ---- */

/** List todos. Sorted: undone first (by sortOrder), then done (by sortOrder). */
export function listTodos() {
  const todos = readAll();
  ensureSortOrder(todos);
  return todos.sort((a, b) => {
    // Done items go to bottom
    if (a.done !== b.done) return a.done ? 1 : -1;
    // Within same done state, sort by sortOrder
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

/** Get a single todo */
export function getTodo(id) {
  return readAll().find((t) => t.id === id) || null;
}

/** Create a new todo */
export function createTodo(text, { priority = 'medium', dueAt = null } = {}) {
  const now = new Date().toISOString();
  const todos = readAll();
  // Assign sortOrder: place new item at the end of undone items
  const maxOrder = todos
    .filter((t) => !t.done)
    .reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0);
  const todo = {
    id: uid(),
    text,
    done: false,
    priority,
    dueAt,
    remindedAt: null,
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };
  todos.push(todo);
  writeAll(todos);
  return todo;
}

/** Update a todo (partial patch) */
export function updateTodo(id, patch) {
  const todos = readAll();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  todos[idx] = { ...todos[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(todos);
  return todos[idx];
}

/** Delete a todo */
export function deleteTodo(id) {
  writeAll(readAll().filter((t) => t.id !== id));
}

/** Toggle done state */
export function toggleTodo(id) {
  const todo = getTodo(id);
  if (!todo) return null;
  return updateTodo(id, { done: !todo.done });
}

/**
 * Reorder todos after a drag-and-drop operation.
 *
 * @param {string[]} orderedIds - The new order of todo IDs within the affected section
 * @param {string} _category - 'today' | 'later' | 'done' (determines which section was reordered)
 */
export function reorderTodos(orderedIds, _category) {
  const todos = readAll();
  const now = new Date().toISOString();

  // Build a map of id → new sortOrder
  const orderMap = new Map();
  orderedIds.forEach((id, index) => {
    orderMap.set(id, index);
  });

  // Update sortOrder for affected items
  for (const todo of todos) {
    if (orderMap.has(todo.id)) {
      todo.sortOrder = orderMap.get(todo.id);
      todo.updatedAt = now;
    }
  }

  writeAll(todos);
}

/** Get todos that are due and haven't been reminded yet */
export function getDueReminders() {
  const now = new Date();
  return readAll().filter((t) => {
    if (t.done || !t.dueAt || t.remindedAt) return false;
    return new Date(t.dueAt) <= now;
  });
}

/** Mark a todo as reminded */
export function markReminded(id) {
  return updateTodo(id, { remindedAt: new Date().toISOString() });
}

/**
 * Ensure legacy todos without sortOrder get a default value.
 * Call this once when loading data, NOT inside memo/pure computations.
 */
export function ensureSortOrder(todos) {
  let needsWrite = false;
  for (const t of todos) {
    if (t.sortOrder == null) {
      t.sortOrder = new Date(t.createdAt).getTime();
      needsWrite = true;
    }
  }
  if (needsWrite) writeAll(todos);
  return todos;
}

/** Categorize todos into today / later / done, sorted by sortOrder. Pure function. */
export function categorize(todos) {

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  const today = [];
  const later = [];
  const done = [];

  for (const t of todos) {
    if (t.done) {
      done.push(t);
      continue;
    }
    if (!t.dueAt) {
      // No deadline → treat as "later"
      later.push(t);
      continue;
    }
    const due = new Date(t.dueAt);
    if (due < endOfDay) {
      today.push(t);
    } else {
      later.push(t);
    }
  }

  // Sort each category by sortOrder (ascending)
  const sortByOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  today.sort(sortByOrder);
  later.sort(sortByOrder);
  done.sort(sortByOrder);

  return { today, later, done };
}
