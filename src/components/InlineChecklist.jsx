import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { format, isPast, isToday, addDays, startOfDay } from 'date-fns';
import { Bell, X } from 'lucide-react';

const PRIORITY_COLORS = {
  high: 'var(--color-priority-high)',
  medium: 'var(--color-priority-medium)',
  low: 'var(--color-priority-low)',
};

const PRIORITY_ORDER = ['low', 'medium', 'high'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Format a due date into a human-readable relative label.
 */
function formatDueLabel(dueAt) {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfterStart = addDays(todayStart, 2);

  if (isToday(d)) return `今天 ${format(d, 'HH:mm')}`;
  if (d >= tomorrowStart && d < dayAfterStart) return `明天 ${format(d, 'HH:mm')}`;
  if (d < todayStart) return `已过期 ${format(d, 'M/d')}`;
  return format(d, 'M/d HH:mm');
}

/**
 * Single checklist row — inline editing with ghost controls on hover.
 */
const ChecklistRow = memo(function ChecklistRow({
  todo,
  onUpdate,
  onDelete,
  onAddAfter,
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(todo.text);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const inputRef = useRef(null);
  const dateRef = useRef(null);

  // Sync text when todo.text changes externally
  useEffect(() => {
    if (!editing) setText(todo.text);
  }, [todo.text, editing]);

  const handleToggle = useCallback(() => {
    onUpdate(todo.id, { done: !todo.done });
  }, [todo.id, todo.done, onUpdate]);

  const handleTextChange = useCallback((e) => {
    setText(e.target.value);
  }, []);

  const handleTextSave = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== todo.text) {
      onUpdate(todo.id, { text: trimmed });
    } else if (!trimmed) {
      // Empty text → delete the row (unless it's the only one)
      onDelete(todo.id);
      return;
    }
    setEditing(false);
  }, [text, todo.id, todo.text, onUpdate, onDelete]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = text.trim();
        if (trimmed && trimmed !== todo.text) {
          onUpdate(todo.id, { text: trimmed });
        }
        setEditing(false);
        // Create new row after this one
        onAddAfter(todo.id);
      }
      if (e.key === 'Backspace' && text === '') {
        e.preventDefault();
        onDelete(todo.id);
      }
      if (e.key === 'Escape') {
        setText(todo.text);
        setEditing(false);
      }
    },
    [text, todo.id, todo.text, onUpdate, onDelete, onAddAfter],
  );

  const handlePriorityCycle = useCallback(() => {
    const next =
      PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(todo.priority) + 1) % 3];
    onUpdate(todo.id, { priority: next });
  }, [todo.id, todo.priority, onUpdate]);

  const handleDateChange = useCallback(
    (e) => {
      const val = e.target.value;
      if (!val) {
        onUpdate(todo.id, { dueAt: null, remindedAt: null });
      } else {
        onUpdate(todo.id, {
          dueAt: new Date(val).toISOString(),
          remindedAt: null,
        });
      }
      setShowDatePicker(false);
    },
    [todo.id, onUpdate],
  );

  const handleDateClick = useCallback(() => {
    if (dateRef.current) {
      if (dateRef.current.showPicker) {
        dateRef.current.showPicker();
      } else {
        dateRef.current.click();
      }
    }
  }, []);

  const dueDate = todo.dueAt ? new Date(todo.dueAt) : null;
  const isOverdue =
    dueDate && isPast(dueDate) && !isToday(dueDate) && !todo.done;
  const dueLabel = formatDueLabel(todo.dueAt);

  return (
    <motion.div
      className="checklist-row group"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {/* Checkbox — spring tap + check animation */}
      <motion.button
        onClick={handleToggle}
        whileTap={{ scale: 0.8 }}
        className={`checklist-checkbox ${todo.done ? 'checked' : ''}`}
        aria-label={todo.done ? '标记为未完成' : '标记为已完成'}
      >
        {todo.done && (
          <motion.svg
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            viewBox="0 0 12 12"
            className="w-2.5 h-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2 6 5 9 10 3" />
          </motion.svg>
        )}
      </motion.button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onBlur={handleTextSave}
            onKeyDown={handleKeyDown}
            autoFocus
            className="checklist-input"
          />
        ) : (
          <span
            onClick={() => {
              setEditing(true);
              setTimeout(() => inputRef.current?.select(), 0);
            }}
            className={`checklist-text cursor-text ${
              todo.done ? 'done' : ''
            } ${isOverdue ? 'overdue' : ''}`}
          >
            {todo.text || '待办事项…'}
          </span>
        )}

        {/* Due time badge — below the text */}
        {dueLabel && !todo.done && (
          <span
            className={`checklist-time-badge ${isOverdue ? 'overdue' : ''}`}
          >
            ⏰ {dueLabel}
          </span>
        )}
      </div>

      {/* Ghost controls — appear on hover */}
      <div className="checklist-controls">
        {/* Reminder button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDatePicker(!showDatePicker);
              setTimeout(() => handleDateClick(), 50);
            }}
            title="设置提醒"
            className={`checklist-ghost-btn ${
              todo.dueAt ? 'has-due' : ''
            }`}
          >
            <Bell size={12} />
          </button>
          {/* Hidden datetime picker */}
          <input
            ref={dateRef}
            type="datetime-local"
            value={
              todo.dueAt
                ? format(new Date(todo.dueAt), "yyyy-MM-dd'T'HH:mm")
                : ''
            }
            onChange={handleDateChange}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>

        {/* Priority button */}
        <button
          onClick={handlePriorityCycle}
          title={`优先级: ${todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}`}
          className="checklist-ghost-btn"
        >
          <span
            className="w-2 h-2 rounded-full transition-transform hover:scale-125"
            style={{ backgroundColor: PRIORITY_COLORS[todo.priority] }}
          />
        </button>

        {/* Delete button */}
        <button
          onClick={() => onDelete(todo.id)}
          title="删除"
          className="checklist-ghost-btn hover:!text-red-400"
        >
          <X size={12} />
        </button>
      </div>
    </motion.div>
  );
});

/**
 * InlineChecklist — zen inline editing experience for checklist mode.
 *
 * Each row is a standalone inline element. Enter creates a new row below.
 * Hover reveals ghost control buttons (reminder, priority, delete).
 */
export default function InlineChecklist({ todos = [], onChange }) {
  const [localTodos, setLocalTodos] = useState(todos);
  const endRef = useRef(null);

  // Sync from parent when todos prop changes (e.g., on entry switch)
  useEffect(() => {
    setLocalTodos(todos);
  }, [todos]);

  // Notify parent of changes
  const emit = useCallback(
    (updated) => {
      setLocalTodos(updated);
      onChange?.(updated);
    },
    [onChange],
  );

  const handleUpdate = useCallback(
    (id, patch) => {
      emit(localTodos.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [localTodos, emit],
  );

  const handleDelete = useCallback(
    (id) => {
      const filtered = localTodos.filter((t) => t.id !== id);
      // Always keep at least one empty row
      if (filtered.length === 0) {
        emit([
          {
            id: uid(),
            text: '',
            done: false,
            priority: 'medium',
            dueAt: null,
            remindedAt: null,
          },
        ]);
      } else {
        emit(filtered);
      }
    },
    [localTodos, emit],
  );

  const handleAddAfter = useCallback(
    (afterId) => {
      const idx = localTodos.findIndex((t) => t.id === afterId);
      const newTodo = {
        id: uid(),
        text: '',
        done: false,
        priority: 'medium',
        dueAt: null,
        remindedAt: null,
      };
      const updated = [...localTodos];
      updated.splice(idx + 1, 0, newTodo);
      emit(updated);
      // Focus the new row will happen via autoFocus on the new input
    },
    [localTodos, emit],
  );

  // If empty, start with one blank row
  const displayTodos =
    localTodos.length > 0
      ? localTodos
      : [
          {
            id: uid(),
            text: '',
            done: false,
            priority: 'medium',
            dueAt: null,
            remindedAt: null,
          },
        ];

  const doneCount = localTodos.filter((t) => t.done).length;
  const totalCount = localTodos.filter((t) => t.text.trim()).length;

  return (
    <div className="checklist-container">
      {/* Progress indicator */}
      {totalCount > 0 && (
        <div className="checklist-progress">
          <div className="checklist-progress-bar">
            <div
              className="checklist-progress-fill"
              style={{
                width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="checklist-progress-text">
            {doneCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Rows */}
      <div className="checklist-rows">
        {displayTodos.map((todo) => (
          <ChecklistRow
            key={todo.id}
            todo={todo}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAddAfter={handleAddAfter}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
