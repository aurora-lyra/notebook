import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { format } from 'date-fns';
import { Inbox, Search, FileEdit } from 'lucide-react';
import DiaryEditor from './DiaryEditor';
import { useEntries } from '../hooks/useEntries';
import { readDraftLocal, clearDraftLocal } from '../lib/db';

/**
 * Single draft item in the list.
 */
const DraftItem = memo(function DraftItem({ entry, isActive, onSelect, isModified }) {
  const isMemo = entry.type === 'memo';
  const date = new Date(entry.createdAt);

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

  return (
    <div
      onClick={() => onSelect(entry.id)}
      className={`group px-4 md:px-5 py-3 md:py-4 cursor-pointer border-b border-border transition-colors
        ${isActive
          ? 'bg-surface-active border-l-2 border-l-ink'
          : 'hover:bg-surface-hover border-l-2 border-l-transparent'
        }`}
    >
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
export default function DraftsPage({ onLocalChange, onPublish, onEditingChange, syncVersion = 0 }) {
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    onEditingChange?.(!!activeId);
  }, [activeId, onEditingChange]);

  // New unpublished drafts
  const { entries: draftEntries, create, update, remove, refresh } = useEntries({
    status: 'draft',
    search,
  }, syncVersion);

  // All published entries (to check for modifications)
  const { entries: publishedEntries } = useEntries({
    status: 'published',
  }, syncVersion);

  // Modified published entries — merge draft data with published entry
  const modifiedEntries = useMemo(() => {
    return publishedEntries
      .map((entry) => {
        const draft = readDraftLocal(entry.id);
        if (!draft) return null;
        return {
          ...entry,
          ...draft,
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

    // Check if this is a modified published entry
    const draft = activeEntry;
    if (draft?._isModified) {
      // Update the original published entry with draft content
      const { _isModified, _originalId, id, ...draftData } = draft;
      update(_originalId, { ...draftData, status: 'published' });
      clearDraftLocal(_originalId);
      onPublish?.({ status: 'published' });
    } else {
      // New draft — just set status to published
      update(activeId, { status: 'published' });
      onLocalChange?.();
    }
    setActiveId(null);
  }, [activeId, activeEntry, update, onLocalChange, onPublish]);

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
            <DraftItem
              key={entry.id}
              entry={entry}
              isActive={activeId === entry.id}
              onSelect={setActiveId}
              isModified={entry._isModified}
            />
          ))}
        </div>
      )}
    </div>
  );
}
