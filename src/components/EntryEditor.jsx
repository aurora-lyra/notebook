import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  BookOpen,
  FileText,
  Pin,
  Star,
  Tag,
  FolderOpen,
  Clock,
  X,
  Plus,
  ChevronLeft,
} from 'lucide-react';
import TipTapEditor from './TipTapEditor';
import InlineChecklist from './InlineChecklist';

/**
 * Tag input component.
 */
function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');

  const addTag = (tag) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput('');
  };

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent-surface text-accent"
        >
          {tag}
          <button onClick={() => removeTag(tag)} className="hover:text-accent-hover">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(input);
          }
          if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        placeholder="添加标签…"
        className="text-xs bg-transparent outline-none placeholder:text-ink-faint min-w-[60px] flex-1"
      />
    </div>
  );
}

/**
 * Entry editor view — title + TipTap editor + metadata sidebar.
 *
 * Props:
 *   - entry: Entry
 *   - onSave: (patch) => void
 *   - onClose: () => void
 */
export default function EntryEditor({ entry, onSave, onClose }) {
  const [title, setTitle] = useState(entry.title);
  const [type, setType] = useState(entry.type);
  const [todos, setTodos] = useState(entry.todos || []);
  const [tags, setTags] = useState(entry.tags);
  const [folder, setFolder] = useState(entry.folder);
  const [pinned, setPinned] = useState(entry.pinned);
  const [favorited, setFavorited] = useState(entry.favorited);
  const [coverUrl, setCoverUrl] = useState(entry.coverUrl);
  const [reminderAt, setReminderAt] = useState(entry.reminderAt || '');
  const [showMeta, setShowMeta] = useState(false);

  const saveTimerRef = useRef(null);

  // Debounced auto-save for metadata fields
  const scheduleSave = useCallback(
    (patch) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave(patch);
      }, 500);
    },
    [onSave],
  );

  // Sync entry changes (switching entries)
  useEffect(() => {
    setTitle(entry.title);
    setType(entry.type);
    setTodos(entry.todos || []);
    setTags(entry.tags);
    setFolder(entry.folder);
    setPinned(entry.pinned);
    setFavorited(entry.favorited);
    setCoverUrl(entry.coverUrl);
    setReminderAt(entry.reminderAt || '');
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value });
  };

  const handleContentUpdate = useCallback(
    (json) => {
      onSave({ content: json });
    },
    [onSave],
  );

  const handleTodosChange = useCallback(
    (newTodos) => {
      setTodos(newTodos);
      onSave({ todos: newTodos });
    },
    [onSave],
  );

  const toggleType = () => {
    const next = type === 'diary' ? 'memo' : 'diary';
    setType(next);
    scheduleSave({ type: next });
  };

  const togglePin = () => {
    setPinned(!pinned);
    scheduleSave({ pinned: !pinned });
  };

  const toggleFav = () => {
    setFavorited(!favorited);
    scheduleSave({ favorited: !favorited });
  };

  const handleTagsChange = (newTags) => {
    setTags(newTags);
    scheduleSave({ tags: newTags });
  };

  const handleFolderChange = (e) => {
    setFolder(e.target.value);
    scheduleSave({ folder: e.target.value });
  };

  const handleCoverChange = (e) => {
    setCoverUrl(e.target.value);
    scheduleSave({ coverUrl: e.target.value });
  };

  const handleReminderChange = (e) => {
    setReminderAt(e.target.value);
    scheduleSave({ reminderAt: e.target.value || null });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 md:gap-3 text-xs text-ink-tertiary">
          {/* Mobile back button */}
          <button
            onClick={onClose}
            className="md:hidden flex items-center gap-1 -ml-1 px-1.5 py-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span>{format(new Date(entry.createdAt), 'yyyy年MM月dd日 HH:mm')}</span>
          <span className="hidden md:inline">·</span>
          <button
            onClick={toggleType}
            className="flex items-center gap-1 hover:text-ink transition-colors"
          >
            {type === 'diary' ? <BookOpen size={13} /> : <FileText size={13} />}
            {type === 'diary' ? '日记' : '备忘录'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleFav}
            title={favorited ? '取消收藏' : '收藏'}
            className="p-1.5 rounded-md hover:bg-surface-hover transition-colors"
          >
            <Star
              size={15}
              className={favorited ? 'text-warning fill-warning' : 'text-ink-tertiary'}
            />
          </button>
          <button
            onClick={togglePin}
            title={pinned ? '取消置顶' : '置顶'}
            className="p-1.5 rounded-md hover:bg-surface-hover transition-colors"
          >
            <Pin size={15} className={pinned ? 'text-accent' : 'text-ink-tertiary'} />
          </button>
          <button
            onClick={() => setShowMeta(!showMeta)}
            title="详情"
            className={`hidden md:block p-1.5 rounded-md transition-colors ${showMeta ? 'bg-surface-active text-ink' : 'text-ink-tertiary hover:bg-surface-hover'}`}
          >
            <Tag size={15} />
          </button>
          <button
            onClick={onClose}
            title="关闭"
            className="hidden md:block p-1.5 rounded-md text-ink-tertiary hover:bg-surface-hover transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main editor area */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover image */}
          {coverUrl && (
            <div className="h-48 bg-surface-active">
              <img
                src={coverUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {/* Title */}
            <input
              value={title}
              onChange={handleTitleChange}
              placeholder="无标题"
              className="w-full text-3xl font-semibold text-ink placeholder:text-ink-faint outline-none bg-transparent tracking-tight leading-tight"
              style={{ letterSpacing: '-0.02em' }}
            />

            {/* Editor — morphs based on type */}
            <div className="mt-6">
              {type === 'memo' ? (
                <InlineChecklist
                  todos={todos}
                  onChange={handleTodosChange}
                />
              ) : (
                <TipTapEditor
                  content={entry.content}
                  onUpdate={handleContentUpdate}
                  autoFocus={!entry.title}
                />
              )}
            </div>
          </div>
        </div>

        {/* Metadata sidebar — hidden on mobile */}
        {showMeta && (
          <div className="hidden md:block w-64 shrink-0 border-l border-border p-4 overflow-y-auto space-y-4">
            <h3 className="text-xs font-medium text-ink-tertiary uppercase tracking-wider">
              详情
            </h3>

            {/* Folder */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-ink-secondary mb-1">
                <FolderOpen size={12} />
                文件夹
              </label>
              <input
                value={folder}
                onChange={handleFolderChange}
                placeholder="未分类"
                className="w-full text-sm bg-transparent border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-ink-secondary mb-1">
                <Tag size={12} />
                标签
              </label>
              <div className="border border-border rounded-md px-2.5 py-1.5 focus-within:border-accent transition-colors">
                <TagInput tags={tags} onChange={handleTagsChange} />
              </div>
            </div>

            {/* Cover URL */}
            <div>
              <label className="text-xs text-ink-secondary mb-1 block">
                封面图 URL
              </label>
              <input
                value={coverUrl}
                onChange={handleCoverChange}
                placeholder="https://..."
                className="w-full text-sm bg-transparent border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Reminder */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-ink-secondary mb-1">
                <Clock size={12} />
                提醒时间
              </label>
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={handleReminderChange}
                className="w-full text-sm bg-transparent border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Meta info */}
            <div className="pt-2 border-t border-border space-y-1">
              <p className="text-xs text-ink-faint">
                创建: {format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm')}
              </p>
              <p className="text-xs text-ink-faint">
                更新: {format(new Date(entry.updatedAt), 'yyyy-MM-dd HH:mm')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
