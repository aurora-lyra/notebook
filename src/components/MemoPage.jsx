import { useState, useCallback, useEffect } from 'react';
import TodoList from './TodoList';
import * as todoStore from '../lib/todoStore';
import { useReminders } from '../hooks/useReminders';

/**
 * MemoPage — memo / to-do module with reminders.
 *
 * All CRUD operations use optimistic updates:
 *   1. Update local state immediately (UI responds instantly)
 *   2. Persist to localStorage (todoStore side effect)
 *   3. Schedule cloud push (onLocalChange)
 *
 * syncVersion triggers a full refresh when remote changes arrive.
 */
export default function MemoPage({ onLocalChange, syncVersion = 0 }) {
  const [todos, setTodos] = useState(() => {
    const all = todoStore.listTodos();
    // Ensure legacy todos have sortOrder (side-effect on first load only)
    todoStore.ensureSortOrder(all);
    return all;
  });

  const refresh = useCallback(() => {
    setTodos(todoStore.listTodos());
  }, []);

  // Refresh when remote sync arrives
  useEffect(() => {
    refresh();
  }, [syncVersion, refresh]);

  // ─── Optimistic: Add ───
  const handleAdd = useCallback(
    (text, opts) => {
      const newTodo = todoStore.createTodo(text, opts);
      // Optimistic: append to state immediately
      setTodos((prev) => [...prev, newTodo]);
      onLocalChange?.();
    },
    [onLocalChange],
  );

  // ─── Optimistic: Toggle ───
  const handleToggle = useCallback(
    (id) => {
      const updated = todoStore.toggleTodo(id);
      // Optimistic: replace in state immediately
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
      onLocalChange?.();
    },
    [onLocalChange],
  );

  // ─── Optimistic: Delete ───
  const handleDelete = useCallback(
    (id) => {
      todoStore.deleteTodo(id);
      // Optimistic: remove from state immediately
      setTodos((prev) => prev.filter((t) => t.id !== id));
      onLocalChange?.();
    },
    [onLocalChange],
  );

  // ─── Optimistic: Update ───
  const handleUpdate = useCallback(
    (id, patch) => {
      const updated = todoStore.updateTodo(id, patch);
      // Optimistic: replace in state immediately
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
      onLocalChange?.();
    },
    [onLocalChange],
  );

  // ─── Optimistic: Reorder (drag sort) ───
  const handleReorder = useCallback(
    (orderedIds, category) => {
      // Re-read after reorder since the operation affects multiple items' sortOrder
      // and the category structure may change
      refresh();
      onLocalChange?.();
    },
    [refresh, onLocalChange],
  );

  // Poll for due reminders
  useReminders(refresh);

  // Also refresh when the tab becomes visible (catch up on reminders)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  return (
    <TodoList
      todos={todos}
      onAdd={handleAdd}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
      onReorder={handleReorder}
    />
  );
}
