import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Cloud, Download, Trash2, X, Loader2, AlertCircle } from 'lucide-react';
import { fetchAllRemoteEntries } from '../lib/syncEngine';

/**
 * Cloud entries management modal.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - onDownload: (entries) => void — called with selected entries
 *   - onDelete: (ids) => void — called with selected entry IDs
 *   - localEntryIds: string[] — IDs of entries that exist locally (for conflict display)
 */
export default function CloudEntriesModal({ open, onClose, onDownload, onDelete, localEntryIds = [] }) {
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null); // 'download' | 'delete' | null
  const fetchedRef = useRef(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllRemoteEntries();
      setEntries(data);
      fetchedRef.current = true;
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchEntries();
    }
    if (!open) {
      setSelected(new Set());
      setAction(null);
      setError(null);
    }
  }, [open, fetchEntries]);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(entries.map((e) => e.id)));
  }, [entries]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleDownload = useCallback(() => {
    if (selected.size === 0) return;
    const toDownload = entries.filter((e) => selected.has(e.id));
    onDownload?.(toDownload);
    onClose();
  }, [selected, entries, onDownload, onClose]);

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(`确定从云端删除选中的 ${selected.size} 篇日记？此操作不可撤销。`);
    if (!confirmed) return;
    const ids = [...selected];
    setAction('delete');
    try {
      await onDelete?.(ids);
      setEntries((prev) => prev.filter((e) => !selected.has(e.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err.message || '删除失败');
    } finally {
      setAction(null);
    }
  }, [selected, onDelete]);

  const selectedCount = selected.size;
  const conflictCount = entries.filter((e) => selected.has(e.id) && localEntryIds.includes(e.id)).length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-lg max-h-[80vh] bg-surface border border-border rounded-2xl
              shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Cloud size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-ink">云端日记管理</h2>
                {entries.length > 0 && (
                  <span className="text-xs text-ink-faint">({entries.length} 篇)</span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-ink-tertiary hover:text-ink hover:bg-surface-hover transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-ink-faint" />
                  <span className="ml-2 text-sm text-ink-faint">加载中…</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 mx-5 mt-4 p-3 rounded-lg bg-danger-surface text-sm text-danger">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                  <button onClick={fetchEntries} className="ml-auto text-xs underline">重试</button>
                </div>
              )}

              {!loading && !error && entries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-ink-faint">
                  <Cloud size={32} className="mb-3 opacity-50" />
                  <p className="text-sm">云端没有日记</p>
                </div>
              )}

              {!loading && !error && entries.length > 0 && (
                <div className="divide-y divide-border">
                  {entries.map((entry) => {
                    const isSelected = selected.has(entry.id);
                    const isLocal = localEntryIds.includes(entry.id);
                    const date = new Date(entry.createdAt);
                    const preview = entry.title || '无标题';

                    return (
                      <div
                        key={entry.id}
                        onClick={() => toggleSelect(entry.id)}
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors
                          ${isSelected ? 'bg-accent/5' : 'hover:bg-surface-hover'}`}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                          ${isSelected ? 'bg-accent border-accent' : 'border-ink-faint'}`}
                        >
                          {isSelected && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-ink truncate">{preview}</h3>
                            {isLocal && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-warning-surface text-warning">
                                本地已有
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-faint mt-0.5">
                            {format(date, 'M月d日 HH:mm')} · {entry.type === 'diary' ? '日记' : '备忘录'}
                            {entry.status === 'draft' && ' · 草稿'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {entries.length > 0 && (
              <div className="border-t border-border px-5 py-3 shrink-0">
                {/* Selection info */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-accent hover:underline"
                    >
                      全选
                    </button>
                    <span className="text-xs text-ink-faint">·</span>
                    <button
                      onClick={deselectAll}
                      className="text-xs text-ink-tertiary hover:underline"
                    >
                      取消
                    </button>
                  </div>
                  <span className="text-xs text-ink-tertiary">
                    已选 {selectedCount} 篇
                    {conflictCount > 0 && (
                      <span className="text-warning ml-1">({conflictCount} 篇本地已有)</span>
                    )}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    disabled={selectedCount === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                      bg-accent text-white text-sm font-medium
                      hover:opacity-90 transition-opacity
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={15} />
                    <span>下载选中</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={selectedCount === 0 || action === 'delete'}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                      border border-danger/30 text-danger text-sm
                      hover:bg-danger-surface transition-colors
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {action === 'delete' ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    <span>删除</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
