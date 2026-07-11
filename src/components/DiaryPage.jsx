import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { format } from 'date-fns';
import { Plus, BookOpen, Search, Star, Pin, Upload } from 'lucide-react';
import DiaryEditor from './DiaryEditor';
import SwipeableRow from './SwipeableRow';
import { useEntries } from '../hooks/useEntries';
import { parse } from '../lib/markdown';

/**
 * Single diary item in the list — memoized to avoid unnecessary re-renders.
 */
const DiaryItem = memo(function DiaryItem({ entry, isActive, onSelect }) {
  const preview = useMemo(() => {
    if (!entry.content?.content) return '';
    const text = entry.content.content
      .map((node) => node.content?.map((n) => n.text || '').join('') || '')
      .join(' ')
      .trim();
    return text.length > 100 ? text.slice(0, 100) + '…' : text;
  }, [entry.content]);

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
  const fileInputRef = useRef(null);

  // Notify parent when editing state changes
  useEffect(() => {
    onEditingChange?.(!!activeId);
  }, [activeId, onEditingChange]);

  const { entries, create, update, remove, refresh } = useEntries({
    type: 'diary',
    search,
  }, syncVersion);

  // Derive active entry from the single entries source — no separate useEntry.
  const activeEntry = useMemo(
    () => (activeId ? entries.find((e) => e.id === activeId) || null : null),
    [entries, activeId],
  );

  const handleNew = useCallback(() => {
    const entry = create({ type: 'diary' });
    setActiveId(entry.id);
    onLocalChange?.();
  }, [create, onLocalChange]);

  const handleSave = useCallback(
    (patch) => {
      if (activeId) {
        // update() writes to db AND updates parent's entries state in one pass.
        // No separate save()/refresh() — single source of truth, no cascade.
        update(activeId, patch);
      }
    },
    [activeId, update],
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
          onLocalChange?.();
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:bg-surface-hover transition-colors"
              title="导入 Markdown 文件"
            >
              <Upload size={13} />
              导入
            </button>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink text-surface text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={13} />
              新日记
            </button>
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
            <SwipeableRow
              key={entry.id}
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
              />
            </SwipeableRow>
          ))}
        </div>
      )}
    </div>
  );
}
