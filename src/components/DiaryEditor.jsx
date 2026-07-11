import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Download } from 'lucide-react';
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
    saved: '已保存',
  };

  return (
    <span className={`save-status ${status}`}>
      <span className="dot" />
      <span>{labels[status]}</span>
    </span>
  );
}

/**
 * Mood Pill — macaron grayscale → color on hover/select.
 */
function MoodPill({ mood, onChange }) {
  return (
    <div className="mood-pill">
      <span className="text-[11px] text-zinc-500 mr-1 select-none">心情</span>
      {MOOD_KEYS.map((key) => {
        const m = MOODS[key];
        const isActive = mood === key;
        return (
          <button
            key={key}
            onClick={() => onChange(isActive ? null : key)}
            title={m.label}
            className={`mood-item ${isActive ? 'selected' : ''}`}
          >
            <span className="text-base">{m.emoji}</span>
            <div
              className="mood-glow"
              style={{ backgroundColor: m.color }}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * DiaryEditor — Moonlight Zen immersive writing interface.
 *
 * Design principles:
 *   - Zen glow ambient light at top
 *   - Serif title with literary tracking
 *   - Mood pill (grayscale → macaron color)
 *   - max-w-2xl centered with generous breathing room
 *   - pt-28 top whitespace for "paper on empty desk" feel
 *
 * Auto-save architecture:
 *   - TipTapEditor fires onUpdate immediately (no debounce)
 *   - DiaryEditor debounces by 1.5s
 *   - onBlur triggers immediate save
 */
export default function DiaryEditor({ entry, onSave, onBack }) {
  const [title, setTitle] = useState(entry.title);
  const [mood, setMood] = useState(entry.mood || null);
  const [saveStatus, setSaveStatus] = useState('idle');

  const titleTimerRef = useRef(null);
  const contentTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const lastSavedContentRef = useRef(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    setTitle(entry.title);
  }, [entry.id]);

  useEffect(() => {
    return () => {
      clearTimeout(titleTimerRef.current);
      clearTimeout(contentTimerRef.current);
      clearTimeout(statusTimerRef.current);
    };
  }, []);

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

  const handleMoodChange = useCallback((newMood) => {
    setMood(newMood);
    onSaveRef.current({ mood: newMood });
  }, []);

  const handleContentUpdate = useCallback((json) => {
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
  }, []);

  const handleBlur = useCallback(() => {
    clearTimeout(contentTimerRef.current);
    contentTimerRef.current = null;
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
      {/* Minimal floating header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300
            transition-colors px-3 py-1.5 rounded-full hover:bg-white/[0.04]"
        >
          <ChevronLeft size={16} />
          <span>返回</span>
        </button>

        <div className="flex items-center gap-4">
          <SaveStatus status={saveStatus} />
          <button
            onClick={handleExport}
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
            title="导出为 Markdown"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Editor area — zen glow + generous breathing room */}
      <div className="flex-1 overflow-y-auto zen-glow">
        <div className="diary-editor max-w-[680px] mx-auto px-6 md:px-8 pt-28 md:pt-32 pb-40 relative z-10">
          {/* Date — whisper quiet */}
          <p className="text-[11px] text-zinc-600 mb-8 tracking-[0.15em] uppercase select-none">
            {format(entryDate, 'yyyy · M月d日 · EEEE')}
          </p>

          {/* Title — literary serif with wide tracking */}
          <input
            value={title}
            onChange={handleTitleChange}
            placeholder="今天想写点什么…"
            className="w-full text-3xl font-light text-zinc-200 placeholder:text-zinc-700
              outline-none bg-transparent leading-tight tracking-wide"
            style={{ fontFamily: 'var(--font-serif)' }}
          />

          {/* Mood Pill */}
          <div className="mt-6 mb-10">
            <MoodPill mood={mood} onChange={handleMoodChange} />
          </div>

          {/* TipTap editor — fully uncontrolled */}
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
