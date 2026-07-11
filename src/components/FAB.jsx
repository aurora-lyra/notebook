import { useState, useRef, useEffect } from 'react';
import { Plus, BookOpen, CheckSquare, X } from 'lucide-react';

/**
 * Speed Dial Floating Action Button — mobile only.
 *
 * Props:
 *   - onNewDiary: () => void
 *   - onNewTask: () => void
 */
export default function FAB({ onNewDiary, onNewTask }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click (mouse + touch)
  useEffect(() => {
    if (!open) return;
    const handleClose = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('touchstart', handleClose, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('touchstart', handleClose);
    };
  }, [open]);

  const handleAction = (fn) => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-30 md:hidden flex flex-col-reverse items-center gap-3">
      {/* Main FAB button */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? '关闭菜单' : '新建'}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          open
            ? 'bg-ink text-surface rotate-45'
            : 'bg-accent text-white hover:bg-accent-hover'
        }`}
      >
        {open ? <X size={22} /> : <Plus size={22} />}
      </button>

      {/* Speed dial actions */}
      <div
        aria-hidden={!open}
        className={`flex flex-col items-center gap-3 transition-all duration-300 origin-bottom ${
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
        }`}
      >
        {/* New Task */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink bg-surface-raised border border-border px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
            新任务
          </span>
          <button
            tabIndex={open ? 0 : -1}
            onClick={() => handleAction(onNewTask)}
            className="w-11 h-11 rounded-full bg-surface-raised border border-border shadow-md flex items-center justify-center text-ink-secondary hover:bg-surface-hover transition-colors"
          >
            <CheckSquare size={18} />
          </button>
        </div>

        {/* New Diary */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink bg-surface-raised border border-border px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
            新日记
          </span>
          <button
            tabIndex={open ? 0 : -1}
            onClick={() => handleAction(onNewDiary)}
            className="w-11 h-11 rounded-full bg-surface-raised border border-border shadow-md flex items-center justify-center text-ink-secondary hover:bg-surface-hover transition-colors"
          >
            <BookOpen size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
