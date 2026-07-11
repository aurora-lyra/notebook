import { useState, useCallback, useMemo, memo } from 'react';
import { format } from 'date-fns';
import { Plus, CheckSquare, Search } from 'lucide-react';
import InlineChecklist from './InlineChecklist';
import SwipeableRow from './SwipeableRow';
import { useEntries } from '../hooks/useEntries';
import { useReminders } from '../hooks/useReminders';

/**
 * Single memo item in the list — memoized.
 */
const MemoItem = memo(function MemoItem({ entry, isActive, onSelect }) {
  const todos = entry.todos || [];
  const total = todos.filter((t) => t.text.trim()).length;
  const done = todos.filter((t) => t.done).length;
  const date = new Date(entry.createdAt);

  return (
    <div
      onClick={() => onSelect(entry.id)}
      className={`group px-4 md:px-5 py-3 md:py-4 cursor-pointer border-b border-border transition-colors
        ${isActive
          ? 'bg-surface-active border-l-2 border-l-ink'
          : 'hover:bg-surface-hover border-l-2 border-l-transparent'
        }`}
    >
      {/* Date */}
      <p className="text-xs text-ink-faint mb-1.5 tracking-wide">
        {format(date, 'M月d日 EEEE')}
      </p>

      {/* Title */}
      <h3 className="text-sm font-medium text-ink leading-snug line-clamp-1 mb-1">
        {entry.title || '无标题'}
      </h3>

      {/* Progress preview */}
      <p className="text-xs text-ink-tertiary leading-relaxed">
        {total === 0 ? '空白清单…' : `${done}/${total} 已完成`}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-2 mt-2">
        <CheckSquare size={11} className="text-ink-faint" />
        <span className="text-xs text-ink-faint">
          {format(date, 'HH:mm')}
        </span>
      </div>
    </div>
  );
});

/**
 * Empty state for memo page.
 */
function MemoEmpty({ onNew }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-20 h-20 rounded-full bg-surface-hover flex items-center justify-center mb-6">
        <CheckSquare size={32} className="text-ink-faint" />
      </div>
      <h2 className="text-lg font-medium text-ink mb-2">
        还没有备忘录
      </h2>
      <p className="text-sm text-ink-tertiary mb-6 max-w-xs leading-relaxed">
        创建一个任务清单，记录你要做的事情。
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-ink text-surface text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        新建备忘录
      </button>
    </div>
  );
}

/**
 * MemoPage — full memo experience with list + InlineChecklist editor.
 */
export default function MemoPage({ onLocalChange, syncVersion = 0 }) {
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');

  // Poll for due reminders
  useReminders();

  const { entries, create, update, remove, refresh } = useEntries({
    type: 'memo',
    search,
  }, syncVersion);

  const activeEntry = useMemo(
    () => (activeId ? entries.find((e) => e.id === activeId) || null : null),
    [entries, activeId],
  );

  const handleNew = useCallback(() => {
    const entry = create({
      type: 'memo',
      title: '',
      todos: [],
    });
    setActiveId(entry.id);
    onLocalChange?.();
  }, [create, onLocalChange]);

  const handleTodosChange = useCallback(
    (newTodos) => {
      if (activeId) {
        update(activeId, { todos: newTodos });
        onLocalChange?.();
      }
    },
    [activeId, update, onLocalChange],
  );

  const handleTitleChange = useCallback(
    (e) => {
      if (activeId) {
        update(activeId, { title: e.target.value });
        onLocalChange?.();
      }
    },
    [activeId, update, onLocalChange],
  );

  const handleBack = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleDelete = useCallback(
    (id) => {
      remove(id);
      if (activeId === id) setActiveId(null);
      onLocalChange?.();
    },
    [remove, activeId, onLocalChange],
  );

  const handlePin = useCallback(
    (id) => {
      const entry = entries.find((e) => e.id === id);
      if (entry) {
        update(id, { pinned: !entry.pinned });
        onLocalChange?.();
      }
    },
    [entries, update, onLocalChange],
  );

  const handleFavorite = useCallback(
    (id) => {
      const entry = entries.find((e) => e.id === id);
      if (entry) {
        update(id, { favorited: !entry.favorited });
        onLocalChange?.();
      }
    },
    [entries, update, onLocalChange],
  );

  // If editing, show full-screen checklist editor
  if (activeEntry) {
    const todos = activeEntry.todos || [];

    return (
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface">
        {/* Minimal floating header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300
              transition-colors px-3 py-1.5 rounded-full hover:bg-white/[0.04]"
          >
            ← 返回
          </button>
        </div>

        {/* Checklist editor area */}
        <div className="flex-1 overflow-y-auto zen-glow">
          <div className="diary-editor max-w-[680px] mx-auto px-6 md:px-8 pt-28 md:pt-32 pb-40 relative z-10">
            {/* Date */}
            <div className="mb-8">
              <span className="text-[11px] text-zinc-600 tracking-[0.15em] uppercase select-none">
                {format(new Date(activeEntry.createdAt), 'yyyy · M月d日 · EEEE')}
              </span>
            </div>

            {/* Title */}
            <input
              value={activeEntry.title}
              onChange={handleTitleChange}
              placeholder="备忘录标题…"
              className="w-full text-3xl font-light text-zinc-200 placeholder:text-zinc-700
                outline-none bg-transparent leading-tight tracking-wide"
              style={{ fontFamily: 'var(--font-serif)' }}
            />

            {/* Inline checklist */}
            <div className="mt-8">
              <InlineChecklist
                todos={todos}
                onChange={handleTodosChange}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show list
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-ink" />
            <h1 className="text-base font-semibold text-ink">备忘录</h1>
            <span className="text-xs text-ink-faint ml-1">{entries.length} 个</span>
          </div>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink text-surface text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={13} />
            新备忘录
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-hover border border-transparent focus-within:border-border transition-colors">
          <Search size={14} className="text-ink-tertiary shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索备忘录…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <MemoEmpty onNew={handleNew} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {entries.map((entry) => (
            <SwipeableRow
              key={entry.id}
              onPin={() => handlePin(entry.id)}
              onDelete={() => handleDelete(entry.id)}
              onFavorite={() => handleFavorite(entry.id)}
              isPinned={entry.pinned}
              isFavorited={entry.favorited}
            >
              <MemoItem
                entry={entry}
                isActive={activeId === entry.id}
                onSelect={setActiveId}
              />
            </SwipeableRow>
          ))}
        </div>
      )}
    </div>
  );
}
