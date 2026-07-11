import { useEffect, useRef } from 'react';
import { getDueReminders, markReminded } from '../lib/todoStore';
import { notify, requestPermission } from '../lib/notifier';

/**
 * Hook that polls for due reminders and sends notifications.
 * Checks every 30 seconds.
 */
export function useReminders(onNavigate) {
  const intervalRef = useRef(null);

  useEffect(() => {
    // Request notification permission on mount
    requestPermission();

    function check() {
      const due = getDueReminders();
      for (const todo of due) {
        notify(
          '待办提醒',
          todo.text,
          {
            tag: `todo-${todo.id}`,
            onclick: () => onNavigate?.(),
          },
        );
        markReminded(todo.id);
      }
    }

    // Check immediately
    check();

    // Then poll every 30 seconds
    intervalRef.current = setInterval(check, 30000);

    return () => clearInterval(intervalRef.current);
  }, [onNavigate]);
}
