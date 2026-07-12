import { useEffect, useRef } from 'react';
import {
  BookOpen,
  FileText,
  CheckSquare,
  Star,
  Pin,
  Inbox,
  Tag,
  FolderOpen,
  Plus,
  X,
  Sun,
  Moon,
  Cloud,
  CloudOff,
  User,
  LogOut,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'all', label: '全部', icon: FileText },
  { id: 'diary', label: '日记', icon: BookOpen },
  { id: 'memo', label: '备忘录', icon: CheckSquare },
  { id: 'drafts', label: '草稿箱', icon: Inbox },
  { id: 'favorited', label: '收藏', icon: Star },
  { id: 'pinned', label: '置顶', icon: Pin },
];

/**
 * Mobile slide-out drawer — replaces Sidebar on small screens.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - activeView: string
 *   - onViewChange: (viewId) => void
 *   - onNewEntry: () => void
 *   - tags: string[]
 *   - folders: string[]
 *   - user: object | null
 *   - onSignOut: () => void
 *   - isDark: boolean
 *   - onToggleTheme: () => void
 */
export default function MobileDrawer({
  open,
  onClose,
  activeView,
  onViewChange,
  onNewEntry,
  tags = [],
  folders = [],
  user = null,
  onSignOut,
  onNavigateSettings,
  isDark = false,
  onToggleTheme,
}) {
  const panelRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleNav = (id) => {
    onViewChange(id);
    onClose();
  };

  return (
    <div className="md:hidden">
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`drawer-overlay fixed inset-0 z-40 bg-black/50 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`drawer-panel fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <h1 className="text-base font-semibold text-ink tracking-tight">
            Notebook
          </h1>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-tertiary hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* New entry */}
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              onNewEntry();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-ink-secondary hover:bg-surface-hover transition-colors"
          >
            <Plus size={15} />
            <span>新建</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors
                ${activeView === id
                  ? 'bg-surface-active text-ink font-medium'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                }`}
            >
              <Icon size={15} className="shrink-0" />
              <span>{label}</span>
            </button>
          ))}

          {/* Folders */}
          {folders.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-2.5 text-xs font-medium text-ink-tertiary uppercase tracking-wider">
                文件夹
              </div>
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => handleNav(`folder:${f}`)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors
                    ${activeView === `folder:${f}`
                      ? 'bg-surface-active text-ink font-medium'
                      : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                    }`}
                >
                  <FolderOpen size={15} className="shrink-0" />
                  <span>{f}</span>
                </button>
              ))}
            </>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-2.5 text-xs font-medium text-ink-tertiary uppercase tracking-wider">
                标签
              </div>
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => handleNav(`tag:${t}`)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors
                    ${activeView === `tag:${t}`
                      ? 'bg-surface-active text-ink font-medium'
                      : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                    }`}
                >
                  <Tag size={15} className="shrink-0" />
                  <span>{t}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-2 py-2.5 shrink-0">
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-ink-secondary hover:bg-surface-hover transition-colors mb-1"
          >
            {isDark ? <Sun size={13} className="shrink-0" /> : <Moon size={13} className="shrink-0" />}
            <span>{isDark ? '浅色模式' : '深色模式'}</span>
          </button>

          {/* Sync indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-ink-secondary hover:bg-surface-hover transition-colors mb-1">
            {user ? (
              <>
                <Cloud size={13} className="text-success" />
                <span>已同步云端</span>
              </>
            ) : (
              <>
                <CloudOff size={13} className="text-ink-faint" />
                <span className="text-ink-faint">仅本地存储</span>
              </>
            )}
          </div>

          {/* User info + logout */}
          {user ? (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-surface-hover transition-colors mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-accent-surface flex items-center justify-center shrink-0">
                  <User size={13} className="text-accent" />
                </div>
                <span className="text-xs text-ink-secondary truncate">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                {onNavigateSettings && (
                  <button
                    onClick={() => { onNavigateSettings(); onClose(); }}
                    title="设置"
                    className="p-1 rounded hover:bg-surface-active text-ink-tertiary hover:text-ink transition-colors"
                  >
                    <Settings size={13} />
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  title="退出登录"
                  className="p-1 rounded hover:bg-surface-active text-ink-tertiary hover:text-ink transition-colors"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
