import { FileText, BookOpen, Plus } from 'lucide-react';

/**
 * Empty state shown when no entry is selected.
 */
export default function EmptyState({ onNewEntry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center mb-6">
        <FileText size={28} className="text-ink-faint" />
      </div>
      <h2 className="text-lg font-medium text-ink mb-2">
        选择一条记录开始阅读
      </h2>
      <p className="text-sm text-ink-tertiary mb-6 max-w-xs">
        从左侧列表选择一条日记或备忘录，或创建一条新的记录。
      </p>
      <button
        onClick={onNewEntry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-surface text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        新建记录
      </button>
    </div>
  );
}
