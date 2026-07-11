import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { format } from 'date-fns';
import { Inbox, Search } from 'lucide-react';
import DiaryEditor from './DiaryEditor';
import { useEntries } from '../hooks/useEntries';

/**
 * Single draft item in the list.
 */
const DraftItem = memo(function DraftItem({ entry, isActive, onSelect }) {
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
      <p className="text-xs text-ink-faint mb-1.5 tracking-wide">
        {format(date, 'M月d日 EEEE')} · {isMemo ? '备忘录' : '日记'}
      </p>
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
 * DraftsPage — shows all unpublished drafts (diary + memo).
 */
export default function DraftsPage({ onLocalChange, onEditingChange, syncVersion = 0 }) {
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    onEditingChange?.(!!activeId);
  }, [activeId, onEditingChange]);

  const { entries, create, update, remove, refresh } = useEntries({
    status: 'draft',
    search,
  }, syncVersion);

  const activeEntry = useMemo(
    () => (activeId ? entries.find((e) => e.id === activeId) || null : null),
    [entries, activeId],
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
    if (activeId) {
      update(activeId, { status: 'published' });
      setActiveId(null);
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
            <span className="text-xs text-ink-faint ml-1">{entries.length} 篇</span>
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
      {entries.length === 0 ? (
        <DraftsEmpty />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {entries.map((entry) => (
            <DraftItem
              key={entry.id}
              entry={entry}
              isActive={activeId === entry.id}
              onSelect={setActiveId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
