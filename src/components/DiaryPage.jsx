import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, BookOpen, Search, Star, Pin, Upload, CheckSquare } from 'lucide-react';
import DiaryEditor from './DiaryEditor';
import SwipeableRow from './SwipeableRow';
import BatchActionBar from './BatchActionBar';
import { useEntries } from '../hooks/useEntries';
import { parse } from '../lib/markdown';
import * as db from '../lib/db';

/**
 * Single diary item in the list — memoized to avoid unnecessary re-renders.
 */
const DiaryItem = memo(function DiaryItem({ entry, isActive, onSelect, selectMode, isSelected, onToggleSelect, onLongPress }) {
  const preview = useMemo(() => {
    if (!entry.content?.content) return '';
    const text = entry.content.content
      .map((node) => node.content?.map((n) => n.text || '').join('') || '')
      .join(' ')
      .trim();
    return text.length > 100 ? text.slice(0, 100) + '…' : text;
  }, [entry.content]);

  const date = new Date(entry.createdAt);
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress?.(entry.id);
    }, 500);
  }, [entry.id, onLongPress]);

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleClick = useCallback(() => {
    // Skip click if long-press just triggered
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
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

      {/* Cover image */}
      {entry.coverUrl && (
        <div className="mb-3 rounded-lg overflow-hidden h-32">
          <img src={entry.coverUrl} alt="" className="w-full h-full object-cover" />
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

      {/* Preview */}
      <p className="text-xs text-ink-tertiary leading-relaxed line-clamp-2">
        {preview || '空白日记…'}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-2 mt-2">
        {entry.pinned && <Pin size={11} className="text-accent" />}
        {entry.favorited && <Star size={11} className="text-warning fill-warning" />}
        <span className="text-xs text-ink-faint">
          {format(date, 'HH:mm')}
        </span>
      </div>
    </div>
  );
});

/**
 * Empty state for diary page.
 */
function DiaryEmpty({ onNew }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-20 h-20 rounded-full bg-surface-hover flex items-center justify-center mb-6">
        <BookOpen size={32} className="text-ink-faint" />
      </div>
      <h2 className="text-lg font-medium text-ink mb-2">
        还没有日记
      </h2>
      <p className="text-sm text-ink-tertiary mb-6 max-w-xs leading-relaxed">
        记录你的想法、感受和故事。每一篇都值得被记住。
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-ink text-surface text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        写第一篇日记
      </button>
    </div>
  );
}

/**
 * DiaryPage — full diary experience with list + editor.
 */
export default function DiaryPage({ onLocalChange, onEditingChange, syncVersion = 0 }) {
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const fileInputRef = useRef(null);

  // Notify parent when editing state changes
  useEffect(() => {
    onEditingChange?.(!!activeId);
  }, [activeId, onEditingChange]);

  const { entries, create, update, remove, batchRemove, refresh } = useEntries({
    type: 'diary',
    status: 'published',
    search,
  }, syncVersion);

  // Derive active entry — check published list first, then localStorage for drafts
  const activeEntry = useMemo(() => {
    if (!activeId) return null;
    return entries.find((e) => e.id === activeId) || db.getEntry(activeId) || null;
  }, [entries, activeId]);

  const handleNew = useCallback(() => {
    const entry = create({ type: 'diary' });
    setActiveId(entry.id);
    // No onLocalChange — new entries are local-only drafts
  }, [create]);

  const handleSave = useCallback(
    (patch) => {
      if (activeId) {
        update(activeId, patch);
      }
    },
    [activeId, update],
  );

  const handlePublish = useCallback(() => {
    if (activeId) {
      update(activeId, { status: 'published' });
      onLocalChange?.();
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
    const confirmed = window.confirm(`确定删除选中的 ${selectedIds.size} 篇日记？`);
    if (!confirmed) return;
    batchRemove([...selectedIds]);
    onLocalChange?.();
    exitSelectMode();
  }, [selectedIds, batchRemove, onLocalChange, exitSelectMode]);

  const handleImport = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('文件过大，请选择 2MB 以内的文件');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const md = ev.target.result;
          const doc = parse(md);

          // Extract title from first heading node
          const firstNode = doc.content?.[0];
          let title = '';
          let content = doc;
          if (firstNode?.type === 'heading' && firstNode.attrs?.level === 1) {
            title = firstNode.content?.map((n) => n.text || '').join('') || '';
            content = { type: 'doc', content: doc.content.slice(1) };
          }

          const entry = create({ type: 'diary', title, content });
          setActiveId(entry.id);
          // No onLocalChange — imported entry is a local-only draft
        } catch (err) {
          console.error('Import failed:', err);
          alert('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
      // Reset so the same file can be re-imported
      e.target.value = '';
    },
    [create, onLocalChange],
  );

  // If editing, show full-screen editor
  if (activeEntry) {
    return (
      <DiaryEditor
        key={activeEntry.id}
        entry={activeEntry}
        onSave={handleSave}
        onPublish={handlePublish}
        onBack={handleBack}
      />
    );
  }

  // Otherwise show list
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleImport}
        className="hidden"
      />

      {/* Header */}
      <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-ink" />
            <h1 className="text-base font-semibold text-ink">日记</h1>
            <span className="text-xs text-ink-faint ml-1">{entries.length} 篇</span>
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <button
                onClick={exitSelectMode}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:bg-surface-hover transition-colors"
              >
                取消
              </button>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:bg-surface-hover transition-colors"
                  title="导入 Markdown 文件"
                >
                  <Upload size={13} />
                  导入
                </button>
                <button
                  onClick={() => setSelectMode(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:bg-surface-hover transition-colors"
                >
                  <CheckSquare size={13} />
                  管理
                </button>
                <button
                  onClick={handleNew}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-surface text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus size={13} />
                  新日记
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
            placeholder="搜索日记…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <DiaryEmpty onNew={handleNew} />
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
                <DiaryItem
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
                  <DiaryItem
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
