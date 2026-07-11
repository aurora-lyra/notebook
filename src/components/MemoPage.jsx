import { useState, useCallback, useEffect } from 'react';
import TodoList from './TodoList';
import * as todoStore from '../lib/todoStore';
import { useReminders } from '../hooks/useReminders';

/**
 * MemoPage — memo / to-do module with reminders.
 */
export default function MemoPage({ onLocalChange }) {
  const [todos, setTodos] = useState(() => {
    const all = todoStore.listTodos();
    // Ensure legacy todos have sortOrder (side-effect on first load only)
    todoStore.ensureSortOrder(all);
    return all;
  });

  const refresh = useCallback(() => {
    setTodos(todoStore.listTodos());
  }, []);

  const handleAdd = useCallback(
    (text, opts) => {
      todoStore.createTodo(text, opts);
      refresh();
      onLocalChange?.();
    },
    [refresh, onLocalChange],
  );

  const handleToggle = useCallback(
    (id) => {
      todoStore.toggleTodo(id);
      refresh();
      onLocalChange?.();
    },
    [refresh, onLocalChange],
  );

  const handleDelete = useCallback(
    (id) => {
      todoStore.deleteTodo(id);
      refresh();
      onLocalChange?.();
    },
    [refresh, onLocalChange],
  );

  const handleUpdate = useCallback(
    (id, patch) => {
      todoStore.updateTodo(id, patch);
      refresh();
      onLocalChange?.();
    },
    [refresh, onLocalChange],
  );

  const handleReorder = useCallback(() => {
    refresh();
    onLocalChange?.();
  }, [refresh, onLocalChange]);

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
