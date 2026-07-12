import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Inbox, Search, FileEdit, ListChecks } from 'lucide-react';
import DiaryEditor from './DiaryEditor';
import BatchActionBar from './BatchActionBar';
import { useEntries } from '../hooks/useEntries';
import { readDraftLocal, clearDraftLocal } from '../lib/db';

/**
 * Single draft item in the list.
 */
const DraftItem = memo(function DraftItem({ entry, isActive, onSelect, isModified, selectMode, isSelected, onToggleSelect, onLongPress }) {
  const isMemo = entry.type === 'memo';
  const date = new Date(entry.createdAt);
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);

  const preview = useMemo(() => {
    if (isMemo) {
      const todos = entry.todos || [];
      const total = todos.filter((t) => t.text.trim()).length;
      return total === 0 ? '空白清单' : `${total} 个待办`;
    }
    if (!entry.content?.content) return '';
    const text = entry.content.content
      .map((node) => node.content?.map((n) => n.text || '').join('') || '')
      .join(' ')
      .trim();
    return text.length > 80 ? text.slice(0, 80) + '…' : text;
  }, [entry.content, entry.todos, isMemo]);

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

      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-xs text-ink-faint tracking-wide">
          {format(date, 'M月d日 EEEE')} · {isMemo ? '备忘录' : '日记'}
        </p>
        {isModified && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent">
            <FileEdit size={10} />
            已修改
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-ink leading-snug line-clamp-1 mb-1">
        {entry.title || '无标题草稿'}
      </h3>
      <p className="text-xs text-ink-tertiary leading-relaxed line-clamp-2">
        {preview || '空白草稿…'}
      </p>
    </div>
  );
});

/**
 * Empty state for drafts page.
 */
function DraftsEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-20 h-20 rounded-full bg-surface-hover flex items-center justify-center mb-6">
        <Inbox size={32} className="text-ink-faint" />
      </div>
      <h2 className="text-lg font-medium text-ink mb-2">草稿箱为空</h2>
      <p className="text-sm text-ink-tertiary mb-6 max-w-xs leading-relaxed">
        创建新日记或备忘录，未发布的内容会自动保存在这里。
      </p>
    </div>
  );
}

/**
 * DraftsPage — shows all unpublished drafts + modified published entries.
 */
export default function DraftsPage({ onLocalChange, onEditingChange, syncVersion = 0 }) {
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    onEditingChange?.(!!activeId);
  }, [activeId, onEditingChange]);

  // New unpublished drafts
  const { entries: draftEntries, update, batchRemove } = useEntries({
    status: 'draft',
    search,
  }, syncVersion);

  // All published entries (to check for modifications)
  const { entries: publishedEntries, refresh: refreshPublished } = useEntries({
    status: 'published',
  }, syncVersion);

  // Modified published entries — merge draft data with published entry
  const modifiedEntries = useMemo(() => {
    return publishedEntries
      .map((entry) => {
        const draft = readDraftLocal(entry.id);
        if (!draft) return null;
        const { id: _did, createdAt: _dca, ...draftData } = draft;
        return {
          ...entry,
          ...draftData,
          _isModified: true,
          _originalId: entry.id,
        };
      })
      .filter(Boolean)
      .filter((entry) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (entry.title || '').toLowerCase().includes(q);
      });
  }, [publishedEntries, search]);

  // Combine both lists, drafts first
  const allDrafts = useMemo(() => [
    ...draftEntries.map((e) => ({ ...e, _isModified: false })),
    ...modifiedEntries,
  ], [draftEntries, modifiedEntries]);

  const activeEntry = useMemo(
    () => (activeId ? allDrafts.find((e) => e.id === activeId) || null : null),
    [allDrafts, activeId],
  );

  const handleSave = useCallback(
    (patch) => {
      if (activeId) {
        update(activeId, patch);
      }
    },
    [activeId, update],
  );

  const handlePublish = useCallback(() => {
    if (!activeId) return;
    // DiaryEditor.handlePublish already called onSave (update) and clearDraftLocal.
    // We only need to trigger cloud sync and close the editor.
    onLocalChange?.();
    setActiveId(null);
  }, [activeId, onLocalChange]);

  const handleBack = useCallback(() => {
    setActiveId(null);
  }, []);

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
    setSelectedIds(new Set(allDrafts.map((e) => e.id)));
  }, [allDrafts]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    // Classify selected IDs into draft vs modified
    const draftIds = [];
    const modifiedOriginalIds = [];
    for (const id of selectedIds) {
      const entry = allDrafts.find((e) => e.id === id);
      if (entry?._isModified) {
        modifiedOriginalIds.push(entry._originalId);
      } else {
        draftIds.push(id);
      }
    }

    const parts = [];
    if (draftIds.length > 0) parts.push(`${draftIds.length} 篇草稿`);
    if (modifiedOriginalIds.length > 0) parts.push(`${modifiedOriginalIds.length} 篇已修改`);

    const confirmed = window.confirm(`确定删除选中的 ${selectedIds.size} 项（${parts.join('、')}）？`);
    if (!confirmed) return;

    // Delete draft entries (local only)
    if (draftIds.length > 0) {
      batchRemove(draftIds);
    }

    // Clear localStorage drafts for modified entries (keep the published entry)
    if (modifiedOriginalIds.length > 0) {
      for (const originalId of modifiedOriginalIds) {
        clearDraftLocal(originalId);
      }
      refreshPublished?.();
      // Only sync when modifying published entries
      onLocalChange?.();
    }

    exitSelectMode();
  }, [selectedIds, allDrafts, batchRemove, refreshPublished, onLocalChange, exitSelectMode]);

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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-ink" />
            <h1 className="text-base font-semibold text-ink">草稿箱</h1>
            <span className="text-xs text-ink-faint ml-1">{allDrafts.length} 篇</span>
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
              <button
                onClick={() => setSelectMode(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:bg-surface-hover transition-colors"
              >
                <ListChecks size={13} />
                管理
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-hover border border-transparent focus-within:border-border transition-colors">
          <Search size={14} className="text-ink-tertiary shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索草稿…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
      </div>

      {/* List */}
      {allDrafts.length === 0 ? (
        <DraftsEmpty />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {allDrafts.map((entry) => (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            >
              <DraftItem
                entry={entry}
                isActive={activeId === entry.id}
                onSelect={setActiveId}
                isModified={entry._isModified}
                selectMode={selectMode}
                isSelected={selectedIds.has(entry.id)}
                onToggleSelect={toggleSelect}
                onLongPress={enterSelectMode}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Batch action bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        totalCount={allDrafts.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onDelete={handleBatchDelete}
        onExit={exitSelectMode}
      />
    </div>
  );
}
