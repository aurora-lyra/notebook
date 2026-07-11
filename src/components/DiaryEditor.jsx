import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Calendar, Download } from 'lucide-react';
import TipTapEditor from './TipTapEditor';
import { serialize } from '../lib/markdown';

/**
 * Auto-save status: 'idle' | 'saving' | 'saved'
 */
function SaveStatus({ status }) {
  const labels = {
    idle: '',
    saving: '正在保存…',
    saved: '已保存到本地',
  };

  return (
    <span className={`save-status ${status}`}>
      <span className="dot" />
      <span>{labels[status]}</span>
    </span>
  );
}

/**
 * DiaryEditor — immersive writing interface.
 *
 * Props:
 *   - entry: the diary entry object
 *   - onSave: (patch) => void — writes to db, does NOT re-render editor
 *   - onBack: () => void
 */
export default function DiaryEditor({ entry, onSave, onBack }) {
  const [title, setTitle] = useState(entry.title);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Separate timer refs for title and content saves — they must not cancel each other
  const titleTimerRef = useRef(null);
  const contentTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync title when switching entries
  useEffect(() => {
    setTitle(entry.title);
  }, [entry.id]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(titleTimerRef.current);
      clearTimeout(contentTimerRef.current);
      clearTimeout(statusTimerRef.current);
    };
  }, []);

  const handleTitleChange = (e) => {
    setTitle(e.target.value);

    // Schedule title save with 1.5s debounce (independent of content timer)
    clearTimeout(titleTimerRef.current);
    clearTimeout(statusTimerRef.current);

    setSaveStatus('saving');
    titleTimerRef.current = setTimeout(() => {
      onSaveRef.current({ title: e.target.value });
      setSaveStatus('saved');
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
    }, 1500);
  };

  // Debounced content save — triggered by TipTapEditor after 1.5s idle (independent of title timer)
  const handleContentUpdate = useCallback(
    (json) => {
      clearTimeout(contentTimerRef.current);
      clearTimeout(statusTimerRef.current);

      setSaveStatus('saving');
      contentTimerRef.current = setTimeout(() => {
        onSaveRef.current({ content: json });
        setSaveStatus('saved');
        statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      }, 1500);
    },
    [],
  );

  const entryDate = new Date(entry.createdAt);

  const handleExport = useCallback(() => {
    const mdContent = serialize(entry.content);
    const dateStr = format(entryDate, 'yyyy-MM-dd');
    const safeTitle = (entry.title || '无标题').replace(/[<>:"/\\|?*]/g, '-').slice(0, 50);
    const filename = `${dateStr}-${safeTitle}.md`;

    const header = `# ${entry.title || '无标题'}\n\n> ${format(entryDate, 'yyyy年M月d日 EEEE')}\n\n`;
    const blob = new Blob([header + mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [entry.title, entry.content, entryDate]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-ink-tertiary hover:text-ink transition-colors -ml-1 px-2 py-1.5 rounded-md hover:bg-surface-hover"
        >
          <ChevronLeft size={18} />
          <span>返回</span>
        </button>

        <div className="flex items-center gap-3">
          <SaveStatus status={saveStatus} />
          <span className="text-xs text-ink-faint">·</span>
          <span className="flex items-center gap-1.5 text-xs text-ink-tertiary">
            <Calendar size={12} />
            {format(entryDate, 'yyyy年M月d日 EEEE')}
          </span>
        </div>

        <button
          onClick={handleExport}
          className="p-1.5 rounded-md text-ink-tertiary hover:bg-surface-hover transition-colors"
          title="导出为 Markdown"
          aria-label="导出为 Markdown"
        >
          <Download size={16} />
        </button>
      </div>

      {/* Editor area — centered, max-width constrained */}
      <div className="flex-1 overflow-y-auto">
        <div className="diary-editor max-w-[700px] mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-32">
          {/* Date subtitle */}
          <p className="text-xs text-ink-faint mb-6 tracking-wide uppercase">
            {format(entryDate, 'yyyy · M月d日 · EEEE')}
          </p>

          {/* Title */}
          <input
            value={title}
            onChange={handleTitleChange}
            placeholder="今天想写点什么…"
            className="w-full text-2xl font-bold text-ink placeholder:text-ink-faint outline-none bg-transparent leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.025em' }}
          />

          {/* Divider */}
          <div className="mt-6 mb-8 border-t border-border" />

          {/* TipTap editor — manages its own state, content only on mount */}
          <TipTapEditor
            content={entry.content}
            onUpdate={handleContentUpdate}
            placeholder="开始书写你的故事…"
            autoFocus={!entry.title}
          />
        </div>
      </div>
    </div>
  );
}
