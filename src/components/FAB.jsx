import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, CheckSquare, X } from 'lucide-react';

/**
 * Speed Dial FAB — Apple-quality spring animations.
 */
export default function FAB({ onNewDiary, onNewTask }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClose = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
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
      {/* Main FAB */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        aria-label={open ? '关闭菜单' : '新建'}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center
          ${open ? 'bg-ink text-surface' : 'bg-accent text-white'}`}
      >
        {open ? <X size={22} /> : <Plus size={22} />}
      </motion.button>

      {/* Speed dial actions */}
      <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.05 }}
            className="flex items-center gap-3"
          >
            <span className="text-xs font-medium text-ink bg-surface-raised border border-border px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
              新任务
            </span>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => handleAction(onNewTask)}
              className="w-11 h-11 rounded-full bg-surface-raised border border-border shadow-md flex items-center justify-center text-ink-secondary"
            >
              <CheckSquare size={18} />
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="flex items-center gap-3"
          >
            <span className="text-xs font-medium text-ink bg-surface-raised border border-border px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
              新日记
            </span>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => handleAction(onNewDiary)}
              className="w-11 h-11 rounded-full bg-surface-raised border border-border shadow-md flex items-center justify-center text-ink-secondary"
            >
              <BookOpen size={18} />
            </motion.button>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
