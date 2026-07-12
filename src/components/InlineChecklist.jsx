import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { format, isPast, isToday, addDays, startOfDay } from 'date-fns';
import { Bell, X, Plus } from 'lucide-react';

const PRIORITY_COLORS = {
  high: 'var(--color-priority-high)',
  medium: 'var(--color-priority-medium)',
  low: 'var(--color-priority-low)',
};

const PRIORITY_ORDER = ['low', 'medium', 'high'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

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
 *
 * KEY FIX: Uses a ref (textRef) to always have the latest text value,
 * avoiding stale closure bugs in useCallback + memo combinations.
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
  const textRef = useRef(todo.text);

  // Keep textRef in sync with local text
  textRef.current = text;

  // Sync text when todo.text changes externally (and not editing)
  useEffect(() => {
    if (!editing) {
      setText(todo.text);
      textRef.current = todo.text;
    }
  }, [todo.text, editing]);

  // CRITICAL: Flush unsaved text on unmount
  useEffect(() => {
    return () => {
      const current = textRef.current.trim();
      if (current && current !== todo.text) {
        onUpdate(todo.id, { text: current });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(() => {
    onUpdate(todo.id, { done: !todo.done });
  }, [todo.id, todo.done, onUpdate]);

  const handleTextChange = useCallback((e) => {
    setText(e.target.value);
    textRef.current = e.target.value;
  }, []);

  // Save using ref — always has latest value, no stale closure
  const handleTextSave = useCallback(() => {
    const current = textRef.current.trim();
    if (current && current !== todo.text) {
      onUpdate(todo.id, { text: current });
    } else if (!current && todo.text) {
      onDelete(todo.id);
      return;
    }
    setEditing(false);
  }, [todo.id, todo.text, onUpdate, onDelete]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const current = textRef.current.trim();
        if (current && current !== todo.text) {
          onUpdate(todo.id, { text: current });
        }
        setEditing(false);
        onAddAfter(todo.id);
      }
      if (e.key === 'Backspace' && textRef.current === '') {
        e.preventDefault();
        onDelete(todo.id);
      }
      if (e.key === 'Escape') {
        setText(todo.text);
        textRef.current = todo.text;
        setEditing(false);
      }
    },
    [todo.id, todo.text, onUpdate, onDelete, onAddAfter],
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
      {/* Checkbox */}
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

        {dueLabel && !todo.done && (
          <span
            className={`checklist-time-badge ${isOverdue ? 'overdue' : ''}`}
          >
            ⏰ {dueLabel}
          </span>
        )}
      </div>

      {/* Ghost controls */}
      <div className="checklist-controls">
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
 */
function ensureNonEmpty(todos) {
  if (todos.length > 0) return todos;
  return [{ id: uid(), text: '', done: false, priority: 'medium', dueAt: null, remindedAt: null }];
}

export default function InlineChecklist({ todos = [], onChange }) {
  const [localTodos, setLocalTodos] = useState(() => ensureNonEmpty(todos));
  const endRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const prevTodosRef = useRef(todos);

  // Keep onChange ref fresh
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync from parent when todos prop changes (but not if parent sends empty and we have content)
  useEffect(() => {
    if (todos === prevTodosRef.current) return;
    prevTodosRef.current = todos;
    if (todos.length === 0 && localTodos.some((t) => t.text.trim())) return;
    setLocalTodos(ensureNonEmpty(todos));
  }, [todos]);

  // Notify parent of changes — use ref to avoid stale closure
  const emit = useCallback(
    (updated) => {
      setLocalTodos(updated);
      onChangeRef.current?.(updated);
    },
    [], // stable — uses ref for onChange
  );

  // Use functional setLocalTodos updater to avoid stale closure race.
  // When Enter triggers onUpdate + onAddAfter in the same tick,
  // the second call reads the latest pending state from the first.

  const handleUpdate = useCallback(
    (id, patch) => {
      setLocalTodos((prev) => {
        const updated = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
        onChangeRef.current?.(updated);
        return updated;
      });
    },
    [],
  );

  const handleDelete = useCallback(
    (id) => {
      setLocalTodos((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        if (filtered.length === 0) {
          const fallback = [{
            id: uid(), text: '', done: false, priority: 'medium', dueAt: null, remindedAt: null,
          }];
          onChangeRef.current?.(fallback);
          return fallback;
        }
        onChangeRef.current?.(filtered);
        return filtered;
      });
    },
    [],
  );

  const handleAddAfter = useCallback(
    (afterId) => {
      setLocalTodos((prev) => {
        const idx = prev.findIndex((t) => t.id === afterId);
        const newTodo = {
          id: uid(), text: '', done: false, priority: 'medium', dueAt: null, remindedAt: null,
        };
        const updated = [...prev];
        updated.splice(idx + 1, 0, newTodo);
        onChangeRef.current?.(updated);
        return updated;
      });
    },
    [],
  );

  const doneCount = localTodos.filter((t) => t.done).length;
  const totalCount = localTodos.filter((t) => t.text.trim()).length;

  // Add a new item at the end of the list
  const handleAddLast = useCallback(() => {
    setLocalTodos((prev) => {
      const newTodo = {
        id: uid(), text: '', done: false, priority: 'medium', dueAt: null, remindedAt: null,
      };
      const updated = [...prev, newTodo];
      onChangeRef.current?.(updated);
      return updated;
    });
  }, []);

  return (
    <div className="checklist-container">
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

      <div className="checklist-rows">
        {localTodos.map((todo) => (
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

      {/* Add new todo button */}
      <button
        onClick={handleAddLast}
        className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg
          text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]
          transition-all duration-200"
      >
        <Plus size={14} />
        <span>添加待办</span>
      </button>
    </div>
  );
}
