import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronLeft, Download } from 'lucide-react';
import TipTapEditor from './TipTapEditor';
import TypeToggle from './TypeToggle';
import InlineChecklist from './InlineChecklist';
import { serialize } from '../lib/markdown';
import { MOODS, MOOD_KEYS, WEATHER, WEATHER_KEYS } from '../lib/moods';

/**
 * Auto-save status: 'idle' | 'saving' | 'saved'
 */
function SaveStatus({ status }) {
  const labels = { idle: '', saving: '正在保存…', saved: '已保存' };
  return (
    <span className={`save-status ${status}`}>
      <span className="dot" />
      <span>{labels[status]}</span>
    </span>
  );
}

/**
 * Capsule selector — reusable for mood and weather.
 */
function CapsuleSelector({ label, items, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = value ? items.find((i) => i.key === value) : null;

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full
          bg-zinc-900/30 border border-white/[0.04] backdrop-blur-md
          text-sm text-zinc-400 hover:text-zinc-200 hover:border-white/[0.08]
          transition-all duration-200 select-none"
      >
        <span className="text-[11px] text-zinc-500">{label}</span>
        {selected ? (
          <span className="flex items-center gap-1">
            <span>{selected.emoji}</span>
          </span>
        ) : (
          <span className="text-zinc-600 text-xs">选择</span>
        )}
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          className="absolute top-full left-0 mt-2 z-30
            bg-zinc-900/90 border border-white/[0.06] backdrop-blur-xl rounded-2xl
            px-2 py-2 flex items-center gap-1
            shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          {items.map((item, i) => {
            const isActive = value === item.key;
            return (
              <motion.button
                key={item.key}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 500, damping: 25 }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  onChange(isActive ? null : item.key);
                  setOpen(false);
                }}
                title={item.label}
                className={`relative flex items-center justify-center w-9 h-9 rounded-full
                  ${isActive
                    ? 'bg-white/[0.08]'
                    : 'hover:bg-white/[0.04] opacity-60 hover:opacity-100'
                  }`}
              >
                <span className="text-lg">{item.emoji}</span>
                {isActive && item.color && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

/**
 * DiaryEditor — Moonlight Zen immersive writing interface.
 *
 * Supports dual-mode rendering:
 *   - type='diary': TipTap rich text editor
 *   - type='memo': InlineChecklist
 *
 * The TypeToggle capsule switches between modes in real-time,
 * updating the database entry type and morphing the UI.
 */
export default function DiaryEditor({ entry, onSave, onBack }) {
  const [title, setTitle] = useState(entry.title);
  const [type, setType] = useState(entry.type || 'diary');
  const [todos, setTodos] = useState(entry.todos || []);
  const [mood, setMood] = useState(entry.mood || null);
  const [weather, setWeather] = useState(entry.weather || null);
  const [createdAt, setCreatedAt] = useState(entry.createdAt);
  const [saveStatus, setSaveStatus] = useState('idle');
  const dateInputRef = useRef(null);

  const titleTimerRef = useRef(null);
  const contentTimerRef = useRef(null);
  const todosTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const lastSavedContentRef = useRef(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => {
    setTitle(entry.title);
    setType(entry.type || 'diary');
    setTodos(entry.todos || []);
    setCreatedAt(entry.createdAt);
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      clearTimeout(titleTimerRef.current);
      clearTimeout(contentTimerRef.current);
      clearTimeout(todosTimerRef.current);
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

  const handleWeatherChange = useCallback((newWeather) => {
    setWeather(newWeather);
    onSaveRef.current({ weather: newWeather });
  }, []);

  const handleDateChange = useCallback((e) => {
    const val = e.target.value;
    if (!val) return;
    const newDate = new Date(val).toISOString();
    setCreatedAt(newDate);
    onSaveRef.current({ createdAt: newDate });
  }, []);

  const handleDateClick = useCallback(() => {
    if (dateInputRef.current) {
      if (dateInputRef.current.showPicker) {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
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

  // Type toggle — morphs the editor UI and persists to database
  const handleTypeChange = useCallback((newType) => {
    setType(newType);
    onSaveRef.current({ type: newType });
  }, []);

  const handleTodosChange = useCallback((newTodos) => {
    setTodos(newTodos);
    clearTimeout(todosTimerRef.current);
    clearTimeout(statusTimerRef.current);
    setSaveStatus('saving');
    todosTimerRef.current = setTimeout(() => {
      onSaveRef.current({ todos: newTodos });
      setSaveStatus('saved');
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
    }, 800);
  }, []);

  const handleBlur = useCallback(() => {
    clearTimeout(contentTimerRef.current);
    contentTimerRef.current = null;
    clearTimeout(statusTimerRef.current);
    setSaveStatus('saved');
    statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
  }, []);

  const entryDate = new Date(createdAt);

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

  const moodItems = MOOD_KEYS.map((key) => ({ key, ...MOODS[key] }));
  const weatherItems = WEATHER_KEYS.map((key) => ({ key, ...WEATHER[key] }));

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
          {/* Date — editable on hover */}
          <div className="mb-8">
            <button
              onClick={handleDateClick}
              className="text-[11px] text-zinc-600 hover:text-zinc-300 tracking-[0.15em] uppercase select-none
                transition-all duration-200 cursor-pointer
                hover:border-b hover:border-dashed hover:border-zinc-500 pb-0.5"
            >
              {format(entryDate, 'yyyy · M月d日 · EEEE')}
            </button>
            <input
              ref={dateInputRef}
              type="datetime-local"
              value={format(entryDate, "yyyy-MM-dd'T'HH:mm")}
              onChange={handleDateChange}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              tabIndex={-1}
            />
          </div>

          {/* Title — literary serif with wide tracking */}
          <input
            value={title}
            onChange={handleTitleChange}
            placeholder={type === 'diary' ? '今天想写点什么…' : '备忘录标题…'}
            className="w-full text-3xl font-light text-zinc-200 placeholder:text-zinc-700
              outline-none bg-transparent leading-tight tracking-wide"
            style={{ fontFamily: 'var(--font-serif)' }}
          />

          {/* Type toggle + Mood + Weather capsules */}
          <div className="flex items-center gap-2.5 mt-6 mb-8 flex-wrap">
            <TypeToggle type={type} onChange={handleTypeChange} />
            <CapsuleSelector
              label="心情"
              items={moodItems}
              value={mood}
              onChange={handleMoodChange}
            />
            <CapsuleSelector
              label="天气"
              items={weatherItems}
              value={weather}
              onChange={handleWeatherChange}
            />
          </div>

          {/* Editor — morphs based on type */}
          {type === 'diary' ? (
            <TipTapEditor
              content={entry.content}
              onUpdate={handleContentUpdate}
              onBlur={handleBlur}
              placeholder="开始书写你的故事…"
              autoFocus={!entry.title}
            />
          ) : (
            <InlineChecklist
              todos={todos}
              onChange={handleTodosChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
