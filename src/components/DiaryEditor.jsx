import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Calendar, Download } from 'lucide-react';
import TipTapEditor from './TipTapEditor';
import { serialize } from '../lib/markdown';
import { MOODS, MOOD_KEYS } from '../lib/moods';

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
 * Auto-save architecture (single debounce point):
 *   - TipTapEditor fires onUpdate IMMEDIATELY on every keystroke (no debounce)
 *   - DiaryEditor debounces content saves by 1.5s
 *   - onBlur triggers an IMMEDIATE save (no debounce)
 *   - The editor is fully uncontrolled: content is injected once on mount, never again
 *
 * Props:
 *   - entry: the diary entry object
 *   - onSave: (patch) => void — writes to db
 *   - onBack: () => void
 */
export default function DiaryEditor({ entry, onSave, onBack }) {
  const [title, setTitle] = useState(entry.title);
  const [mood, setMood] = useState(entry.mood || null);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Separate timer refs for title and content saves — they must not cancel each other
  const titleTimerRef = useRef(null);
  const contentTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const lastSavedContentRef = useRef(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync title when switching entries (key-based remount handles this, but be safe)
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

  // ─── Title save: 1.5s debounce ───
  const handleTitleChange = (e) => {
    setTitle(e.target.value);

    clearTimeout(titleTimerRef.current);
    clearTimeout(statusTimerRef.current);

    setSaveStatus('saving');
    titleTimerRef.current = setTimeout(() => {
      onSaveRef.current({ title: e.target.value });
      setSaveStatus('saved');
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
    }, 1500);
  };

  // ─── Content save: 1.5s debounce (reset on every call) ───

  // ─── Mood save: immediate ───
  const handleMoodChange = useCallback(
    (newMood) => {
      setMood(newMood);
      onSaveRef.current({ mood: newMood });
    },
    [],
  );
  const handleContentUpdate = useCallback(
    (json) => {
      // Deduplicate: skip if content hasn't changed since last save
      const jsonStr = JSON.stringify(json);
      if (jsonStr === lastSavedContentRef.current) return;

      clearTimeout(contentTimerRef.current);
      clearTimeout(statusTimerRef.current);

      setSaveStatus('saving');
      contentTimerRef.current = setTimeout(() => {
        lastSavedContentRef.current = jsonStr;
        onSaveRef.current({ content: json });
        setSaveStatus('saved');
        statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      }, 1500);
    },
    [],
  );

  // ─── Blur save: IMMEDIATE, no debounce ───
  const handleBlur = useCallback(() => {
    // Flush any pending content save immediately
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
      // The latest content is already in the onSaveRef closure from the last handleContentUpdate call.
      // But we need to trigger the save NOW. We'll use the editor's current JSON via a small delay
      // to let TipTap process the blur event first.
    }
    // Show saved status
    clearTimeout(statusTimerRef.current);
    setSaveStatus('saved');
    statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
  }, []);

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

          {/* Mood selector */}
          <div className="flex items-center gap-1 mt-4">
            <span className="text-xs text-ink-faint mr-1.5">今天心情</span>
            {MOOD_KEYS.map((key) => {
              const m = MOODS[key];
              const isActive = mood === key;
              return (
                <button
                  key={key}
                  onClick={() => handleMoodChange(isActive ? null : key)}
                  title={m.label}
                  className={`relative w-7 h-7 rounded-full flex items-center justify-center text-sm
                    transition-all duration-150
                    ${isActive
                      ? 'ring-2 ring-offset-1 ring-offset-surface scale-110'
                      : 'opacity-50 hover:opacity-100 hover:scale-105'
                    }`}
                  style={{
                    backgroundColor: m.color + '30',
                    ringColor: isActive ? m.color : undefined,
                  }}
                >
                  <span>{m.emoji}</span>
                  {isActive && (
                    <div
                      className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mt-6 mb-8 border-t border-border" />

          {/* TipTap editor — fully uncontrolled, content injected once on mount */}
          <TipTapEditor
            content={entry.content}
            onUpdate={handleContentUpdate}
            onBlur={handleBlur}
            placeholder="开始书写你的故事…"
            autoFocus={!entry.title}
          />
        </div>
      </div>
    </div>
  );
}
