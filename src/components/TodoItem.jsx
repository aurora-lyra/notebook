import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast, isToday } from 'date-fns';
import { Check, Trash2, Clock, GripVertical } from 'lucide-react';

const PRIORITY_COLORS = {
  high: 'var(--color-priority-high)',
  medium: 'var(--color-priority-medium)',
  low: 'var(--color-priority-low)',
};

const PRIORITY_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
};

/**
 * Single sortable todo item — one-line minimal design.
 */
export default function TodoItem({ todo, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(todo.text);
  const inputRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    boxShadow: isDragging ? 'var(--shadow-lg)' : undefined,
  };

  const dueDate = todo.dueAt ? new Date(todo.dueAt) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && !todo.done;
  const isDueToday = dueDate && isToday(dueDate);

  const handleTextSave = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== todo.text) {
      onUpdate(todo.id, { text: trimmed });
    } else {
      setText(todo.text);
    }
    setEditing(false);
  };

  const handlePriorityCycle = () => {
    const order = ['low', 'medium', 'high'];
    const next = order[(order.indexOf(todo.priority) + 1) % 3];
    onUpdate(todo.id, { priority: next });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors
        ${isDragging ? 'bg-surface-raised ring-2 ring-accent/20' : ''}
        ${todo.done ? 'opacity-50' : 'hover:bg-surface-hover'}`}
    >
      {/* Drag handle — only for undone items */}
      {!todo.done ? (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 -ml-1 text-ink-faint hover:text-ink-tertiary cursor-grab active:cursor-grabbing touch-none"
          aria-label="拖拽排序"
        >
          <GripVertical size={14} />
        </button>
      ) : (
        <div className="w-5 shrink-0" />
      )}

      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo.id)}
        className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all
          ${todo.done
            ? 'bg-ink border-ink'
            : 'border-border-strong hover:border-ink'
          }`}
      >
        {todo.done && <Check size={11} className="text-surface" strokeWidth={3} />}
      </button>

      {/* Priority dot — click to cycle */}
      <button
        onClick={handlePriorityCycle}
        title={`优先级: ${PRIORITY_LABELS[todo.priority]}`}
        className="shrink-0 w-2 h-2 rounded-full transition-colors hover:scale-125"
        style={{ backgroundColor: PRIORITY_COLORS[todo.priority] }}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleTextSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSave();
              if (e.key === 'Escape') {
                setText(todo.text);
                setEditing(false);
              }
            }}
            autoFocus
            className="w-full text-sm text-ink bg-transparent outline-none border-b border-accent pb-0.5"
          />
        ) : (
          <span
            onDoubleClick={() => {
              setEditing(true);
              setTimeout(() => inputRef.current?.select(), 0);
            }}
            className={`text-sm leading-snug cursor-text
              ${todo.done
                ? 'line-through text-ink-tertiary'
                : 'text-ink'
              }`}
          >
            {todo.text}
          </span>
        )}
      </div>

      {/* Due date badge */}
      {dueDate && !todo.done && (
        <span
          className={`shrink-0 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded
            ${isOverdue
              ? 'text-danger bg-danger-surface'
              : isDueToday
                ? 'text-warning bg-warning-surface'
                : 'text-ink-tertiary'
            }`}
        >
          <Clock size={10} />
          {isDueToday ? '今天' : format(dueDate, 'M/d')}
        </span>
      )}

      {/* Delete — show on hover */}
      <button
        onClick={() => onDelete(todo.id)}
        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-ink-faint hover:text-danger hover:bg-danger-surface transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
