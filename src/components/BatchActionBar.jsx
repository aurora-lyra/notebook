import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X, CheckSquare, Square } from 'lucide-react';

/**
 * Floating action bar for batch operations.
 *
 * Props:
 *   - selectedCount: number of selected items
 *   - totalCount: total number of items
 *   - onSelectAll: () => void
 *   - onDeselectAll: () => void
 *   - onDelete: () => void — called with selected IDs
 *   - onExit: () => void — exit selection mode
 */
export default function BatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onExit,
}) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
            flex items-center gap-3 px-5 py-3 rounded-2xl
            bg-surface/95 border border-border backdrop-blur-xl
            shadow-[0_8px_40px_rgba(0,0,0,0.2)]"
        >
          {/* Select all / deselect */}
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full
              text-sm text-ink-tertiary hover:text-ink hover:bg-surface-hover
              transition-all duration-200"
          >
            {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
            <span>{allSelected ? '取消全选' : '全选'}</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-border" />

          {/* Selected count */}
          <span className="text-sm text-ink-tertiary px-2">
            已选 <span className="text-ink font-medium">{selectedCount}</span> 篇
          </span>

          {/* Divider */}
          <div className="w-px h-5 bg-border" />

          {/* Delete */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full
              bg-danger-surface border border-danger/20
              text-sm text-danger hover:bg-danger-surface
              transition-all duration-200"
          >
            <Trash2 size={14} />
            <span>删除</span>
          </motion.button>

          {/* Exit */}
          <button
            onClick={onExit}
            className="p-1.5 rounded-full text-ink-tertiary hover:text-ink
              hover:bg-surface-hover transition-all duration-200"
            title="退出选择"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
