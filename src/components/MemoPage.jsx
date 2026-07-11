import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, CheckSquare, Search, Send, ListChecks } from 'lucide-react';
import InlineChecklist from './InlineChecklist';
import SwipeableRow from './SwipeableRow';
import BatchActionBar from './BatchActionBar';
import { useEntries } from '../hooks/useEntries';
import { useReminders } from '../hooks/useReminders';

/**
 * Single memo item in the list — memoized.
 */
const MemoItem = memo(function MemoItem({ entry, isActive, onSelect, selectMode, isSelected, onToggleSelect, onLongPress }) {
  const todos = entry.todos || [];
  const total = todos.filter((t) => t.text.trim()).length;
  const done = todos.filter((t) => t.done).length;
  const date = new Date(entry.createdAt);
  const longPressTimer = useRef(null);

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      onLongPress?.(entry.id);
    }, 500);
  }, [entry.id, onLongPress]);

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleClick = useCallback(() => {
    if (selectMode) {
      onToggleSelect?.(entry.id);
    } else {
      onSelect(entry.id);
    }
  }, [selectMode, entry.id, onSelect, onToggleSelect]);

  return (
    <div
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`group relative px-4 md:px-5 py-3 md:py-4 cursor-pointer border-b border-border transition-colors
        ${isActive && !selectMode
          ? 'bg-surface-active border-l-2 border-l-ink'
          : isSelected
            ? 'bg-accent/5 border-l-2 border-l-accent'
            : 'hover:bg-surface-hover border-l-2 border-l-transparent'
        }`}
    >
      {/* Selection checkbox */}
      {selectMode && (
        <div className="absolute top-3 right-3 z-10">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
            ${isSelected ? 'bg-accent border-accent' : 'border-ink-faint'}`}
          >
            {isSelected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      )}

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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Poll for due reminders
  useReminders();

  const { entries, create, update, remove, batchRemove, refresh } = useEntries({
    type: 'memo',
    status: 'published',
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
    // No onLocalChange — new entries are local-only drafts
  }, [create]);

  const handleTodosChange = useCallback(
    (newTodos) => {
      if (activeId) {
        update(activeId, { todos: newTodos });
        // Local-only — no onLocalChange
      }
    },
    [activeId, update],
  );

  const titleRef = useRef('');

  const handleTitleChange = useCallback(
    (e) => {
      titleRef.current = e.target.value;
      if (activeId) {
        update(activeId, { title: e.target.value });
        // Local-only — no onLocalChange
      }
    },
    [activeId, update],
  );

  const handleTitleBlur = useCallback(() => {
    // Flush title on blur — ensures save even if onChange was missed
    if (activeId && titleRef.current) {
      update(activeId, { title: titleRef.current });
      // Local-only — no onLocalChange
    }
  }, [activeId, update]);

  /** Publish — sync to cloud. */
  const handlePublish = useCallback(() => {
    if (activeId) {
      update(activeId, { status: 'published' });
      onLocalChange?.();
      setActiveId(null);
    }
  }, [activeId, update, onLocalChange]);

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

  /* ---- Batch selection ---- */
  const enterSelectMode = useCallback((id) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(entries.map((e) => e.id)));
  }, [entries]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`确定删除选中的 ${selectedIds.size} 个备忘录？`);
    if (!confirmed) return;
    batchRemove([...selectedIds]);
    onLocalChange?.();
    exitSelectMode();
  }, [selectedIds, batchRemove, onLocalChange, exitSelectMode]);

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
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-600">草稿已保存在本地</span>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePublish}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full
                bg-white/[0.08] border border-white/[0.06] backdrop-blur-md
                text-sm text-zinc-200 hover:text-white hover:bg-white/[0.12]
                transition-all duration-200"
            >
              <Send size={13} />
              <span>发布</span>
            </motion.button>
          </div>
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
              onBlur={handleTitleBlur}
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
          <div className="flex items-center gap-2">
            {selectMode ? (
              <button
                onClick={exitSelectMode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:bg-surface-hover transition-colors"
              >
                取消
              </button>
            ) : (
              <>
                <button
                  onClick={() => setSelectMode(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:bg-surface-hover transition-colors"
                >
                  <ListChecks size={13} />
                  管理
                </button>
                <button
                  onClick={handleNew}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink text-surface text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus size={13} />
                  新备忘录
                </button>
              </>
            )}
          </div>
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
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            >
              {selectMode ? (
                <MemoItem
                  entry={entry}
                  isActive={false}
                  onSelect={setActiveId}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(entry.id)}
                  onToggleSelect={toggleSelect}
                  onLongPress={enterSelectMode}
                />
              ) : (
                <SwipeableRow
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
                    selectMode={false}
                    isSelected={false}
                    onLongPress={enterSelectMode}
                  />
                </SwipeableRow>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Batch action bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        totalCount={entries.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onDelete={handleBatchDelete}
        onExit={exitSelectMode}
      />
    </div>
  );
}
