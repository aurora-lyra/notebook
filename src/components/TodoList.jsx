import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Plus, Calendar, ChevronDown, ChevronRight, Bell, BellOff, CheckCircle } from 'lucide-react';
import TodoItem from './TodoItem';
import { categorize, reorderTodos } from '../lib/todoStore';
import { requestPermission, canNotify } from '../lib/notifier';

/**
 * Add-task input bar.
 */
function AddTaskBar({ onAdd }) {
  const [text, setText] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('medium');
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, {
      priority,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setText('');
    setDueAt('');
    setPriority('medium');
    setExpanded(false);
  };

  return (
    <form onSubmit={handleSubmit} className="px-3 mb-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border focus-within:border-accent transition-colors bg-surface">
        <Plus size={15} className="text-ink-tertiary shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder="添加任务…"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-ink-faint text-ink"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="text-xs px-2 py-1 rounded bg-ink text-surface disabled:opacity-30 transition-opacity"
        >
          添加
        </button>
      </div>

      {/* Expanded options */}
      {expanded && (
        <div className="flex items-center gap-3 mt-2 px-1">
          {/* Due date */}
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-ink-tertiary" />
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:border-accent"
            />
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-tertiary">优先级</span>
            {[
              { key: 'low', color: 'var(--color-priority-low)', label: '低' },
              { key: 'medium', color: 'var(--color-priority-medium)', label: '中' },
              { key: 'high', color: 'var(--color-priority-high)', label: '高' },
            ].map(({ key, color, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPriority(key)}
                className="w-3.5 h-3.5 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: priority === key ? color : 'transparent',
                  borderColor: color,
                  opacity: priority === key ? 1 : 0.4,
                }}
                title={label}
              />
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * Collapsible section with count.
 */
function Section({ title, icon: Icon, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-ink-tertiary uppercase tracking-wider hover:text-ink transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Icon size={13} />
        <span>{title}</span>
        <span className="ml-auto text-ink-faint">{count}</span>
      </button>
      {open && <div className="space-y-0.5 px-1">{children}</div>}
    </div>
  );
}

/**
 * DragOverlay ghost card — renders the dragged item's visual representation.
 */
function DragOverlayContent({ todo }) {
  if (!todo) return null;
  return (
    <div className="drag-overlay px-3 py-2.5 flex items-center gap-2.5">
      <div className="w-5 shrink-0" />
      <div className={`shrink-0 w-[18px] h-[18px] rounded-full border-2 ${
        todo.done ? 'bg-ink border-ink' : 'border-border-strong'
      }`} />
      <div className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-priority-${todo.priority})` }} />
      <span className="text-sm text-ink">{todo.text}</span>
    </div>
  );
}

/**
 * TodoList — main memo component with categorized, sortable tasks.
 */
export default function TodoList({ todos, onAdd, onToggle, onDelete, onUpdate, onReorder }) {
  const { today, later, done } = useMemo(() => categorize(todos), [todos]);

  const [notifEnabled, setNotifEnabled] = useState(canNotify());
  const [activeId, setActiveId] = useState(null);

  // Refs for stale-closure-safe access in drag handlers
  const sectionMap = useMemo(() => ({
    today: today.map((t) => t.id),
    later: later.map((t) => t.id),
    done: done.map((t) => t.id),
  }), [today, later, done]);

  const allTodos = useMemo(() => [...today, ...later, ...done], [today, later, done]);

  const handleEnableNotif = useCallback(async () => {
    const result = await requestPermission();
    setNotifEnabled(result === 'granted');
  }, []);

  // Drag-and-drop sensors — require 8px movement before activating (avoids accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // Find which section a todo ID belongs to
  const findSection = useCallback(
    (id) => {
      if (sectionMap.today.includes(id)) return 'today';
      if (sectionMap.later.includes(id)) return 'later';
      if (sectionMap.done.includes(id)) return 'done';
      return null;
    },
    [sectionMap],
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const fromSection = findSection(active.id);
      const toSection = findSection(over.id);
      if (!fromSection || !toSection) return;

      // Same-section reorder
      if (fromSection === toSection) {
        const items = sectionMap[fromSection];
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(items, oldIndex, newIndex);
        reorderTodos(reordered, fromSection);
        onReorder?.();
      }
      // Cross-section move: place item at the target position in the new section
      else {
        // Remove from source, insert at target position in destination
        const sourceItems = sectionMap[fromSection].filter((id) => id !== active.id);
        const destItems = [...sectionMap[toSection]];
        const targetIndex = destItems.indexOf(over.id);
        destItems.splice(targetIndex, 0, active.id);

        reorderTodos(sourceItems, fromSection);
        reorderTodos(destItems, toSection);
        onReorder?.();
      }
    },
    [findSection, sectionMap, onReorder],
  );

  const activeTodo = activeId ? allTodos.find((t) => t.id === activeId) : null;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-3 md:px-4 pt-3 md:pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-semibold text-ink">备忘录</h1>
            <p className="text-xs text-ink-tertiary mt-0.5">
              {today.length + later.length} 个待办 · {done.length} 个已完成
            </p>
          </div>

          {/* Notification toggle */}
          <button
            onClick={notifEnabled ? undefined : handleEnableNotif}
            title={notifEnabled ? '通知已开启' : '开启通知提醒'}
            className={`p-2 rounded-lg transition-colors
              ${notifEnabled
                ? 'text-accent bg-accent-surface'
                : 'text-ink-tertiary hover:bg-surface-hover'
              }`}
          >
            {notifEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          </button>
        </div>

        {/* Add task */}
        <AddTaskBar onAdd={onAdd} />
      </div>

      {/* Sections with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto py-2">
          {/* Today */}
          <Section title="今天" icon={Calendar} count={today.length} defaultOpen={true}>
            <SortableContext items={sectionMap.today} strategy={verticalListSortingStrategy}>
              {today.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                />
              ))}
            </SortableContext>
          </Section>

          {/* Later */}
          <Section title="以后" icon={Calendar} count={later.length} defaultOpen={true}>
            <SortableContext items={sectionMap.later} strategy={verticalListSortingStrategy}>
              {later.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                />
              ))}
            </SortableContext>
          </Section>

          {/* Done */}
          <Section title="已完成" icon={CheckCircle} count={done.length} defaultOpen={false}>
            <SortableContext items={sectionMap.done} strategy={verticalListSortingStrategy}>
              {done.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                />
              ))}
            </SortableContext>
          </Section>

          {/* Empty state */}
          {todos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center mb-4">
                <Calendar size={28} className="text-ink-faint" />
              </div>
              <p className="text-sm text-ink-tertiary">还没有任务</p>
              <p className="text-xs text-ink-faint mt-1">在上方添加你的第一个待办事项</p>
            </div>
          )}
        </div>

        {/* DragOverlay — ghost card following cursor */}
        <DragOverlay>
          <DragOverlayContent todo={activeTodo} />
        </DragOverlay>
      </DndContext>
    </div>
  );
}
