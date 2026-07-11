import { Menu, Search, X } from 'lucide-react';
import { useState } from 'react';

const VIEW_LABELS = {
  all: '全部记录',
  diary: '日记',
  memo: '备忘录',
  favorited: '收藏',
  pinned: '置顶',
};

/**
 * Mobile top navigation bar — visible only on small screens.
 *
 * Props:
 *   - activeView: string
 *   - onMenuOpen: () => void
 *   - searchQuery: string
 *   - onSearchChange: (q) => void
 */
export default function MobileHeader({
  activeView,
  onMenuOpen,
  searchQuery,
  onSearchChange,
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const label = activeView.startsWith('tag:')
    ? `标签: ${activeView.slice(4)}`
    : activeView.startsWith('folder:')
      ? `文件夹: ${activeView.slice(7)}`
      : VIEW_LABELS[activeView] || 'Notebook';

  return (
    <header className="md:hidden sticky top-0 z-30 bg-surface border-b border-border">
      {searchOpen ? (
        /* Search mode */
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => {
              setSearchOpen(false);
              onSearchChange('');
            }}
            className="p-1.5 rounded-md text-ink-tertiary hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
      ) : (
        /* Normal mode */
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            onClick={onMenuOpen}
            className="p-1.5 rounded-md text-ink-secondary hover:bg-surface-hover transition-colors"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-ink truncate mx-3">
            {label}
          </h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="p-1.5 rounded-md text-ink-secondary hover:bg-surface-hover transition-colors"
          >
            <Search size={18} />
          </button>
        </div>
      )}
    </header>
  );
}
