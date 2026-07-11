import { useEffect, useRef } from 'react';
import * as db from '../lib/db';
import { notify, requestPermission } from '../lib/notifier';

/**
 * Hook that polls for due reminders from entry-embedded todos.
 * Scans all entries' todos arrays for items with dueAt <= now.
 * Checks every 30 seconds.
 */
export function useReminders(onNavigate) {
  const intervalRef = useRef(null);

  useEffect(() => {
    // Request notification permission on mount
    requestPermission();

    function check() {
      const now = new Date();
      const entries = db.listEntries();

      for (const entry of entries) {
        if (!entry.todos || entry.type !== 'memo') continue;

        let hasChanges = false;
        const updatedTodos = entry.todos.map((todo) => {
          if (todo.done || !todo.dueAt || todo.remindedAt) return todo;
          if (new Date(todo.dueAt) > now) return todo;

          // This todo is due — send notification
          notify('待办提醒', todo.text, {
            tag: `todo-${todo.id}`,
            onclick: () => onNavigate?.(),
          });

          hasChanges = true;
          return { ...todo, remindedAt: now.toISOString() };
        });

        // Persist remindedAt changes
        if (hasChanges) {
          db.updateEntry(entry.id, { todos: updatedTodos });
        }
      }
    }

    // Check immediately
    check();

    // Then poll every 30 seconds
    intervalRef.current = setInterval(check, 30000);

    return () => clearInterval(intervalRef.current);
  }, [onNavigate]);
}
