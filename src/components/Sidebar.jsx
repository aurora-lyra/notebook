import {
  BookOpen,
  FileText,
  CheckSquare,
  Star,
  Pin,
  Tag,
  FolderOpen,
  Plus,
  Search,
  LogOut,
  Cloud,
  CloudOff,
  User,
  Sun,
  Moon,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'all', label: '全部', icon: FileText },
  { id: 'diary', label: '日记', icon: BookOpen },
  { id: 'memo', label: '备忘录', icon: CheckSquare },
  { id: 'favorited', label: '收藏', icon: Star },
  { id: 'pinned', label: '置顶', icon: Pin },
];

/**
 * Sidebar navigation.
 *
 * Props:
 *   - activeView: string
 *   - onViewChange: (viewId) => void
 *   - onNewEntry: () => void
 *   - tags: string[]
 *   - folders: string[]
 *   - searchQuery: string
 *   - onSearchChange: (q) => void
 */
export default function Sidebar({
  activeView,
  onViewChange,
  onNewEntry,
  tags = [],
  folders = [],
  searchQuery,
  onSearchChange,
  user = null,
  onSignOut,
  onNavigateSettings,
  isDark = false,
  onToggleTheme,
}) {
  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-2">
        <h1 className="text-base font-semibold text-ink tracking-tight">
          Notebook
        </h1>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-hover border border-transparent focus-within:border-border transition-colors">
          <Search size={14} className="text-ink-tertiary shrink-0" />
          <input
            type="text"
            placeholder="搜索…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
      </div>

      {/* New entry */}
      <div className="px-3 pb-2">
        <button
          onClick={onNewEntry}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-ink-secondary hover:bg-surface-hover transition-colors"
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
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] tracking-wide transition-all duration-200
              ${activeView === id
                ? 'bg-white/[0.06] text-ink font-normal'
                : 'text-ink-secondary hover:bg-white/[0.03] hover:text-ink font-light'
              }`}
          >
            <Icon size={15} className="shrink-0 opacity-70" />
            <span>{label}</span>
          </button>
        ))}

        {/* Folders */}
        {folders.length > 0 && (
          <>
            <div className="pt-3 pb-1 px-2.5 text-[10px] font-normal text-ink-faint uppercase tracking-[0.08em]">
              文件夹
            </div>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => onViewChange(`folder:${f}`)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] tracking-wide transition-all duration-200
                  ${activeView === `folder:${f}`
                    ? 'bg-white/[0.06] text-ink font-normal'
                    : 'text-ink-secondary hover:bg-white/[0.03] hover:text-ink font-light'
                  }`}
              >
                <FolderOpen size={15} className="shrink-0 opacity-70" />
                <span>{f}</span>
              </button>
            ))}
          </>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <>
            <div className="pt-3 pb-1 px-2.5 text-[10px] font-normal text-ink-faint uppercase tracking-[0.08em]">
              标签
            </div>
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => onViewChange(`tag:${t}`)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] tracking-wide transition-all duration-200
                  ${activeView === `tag:${t}`
                    ? 'bg-white/[0.06] text-ink font-normal'
                    : 'text-ink-secondary hover:bg-white/[0.03] hover:text-ink font-light'
                  }`}
              >
                <Tag size={15} className="shrink-0 opacity-70" />
                <span>{t}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Footer — sync status + user */}
      <div className="border-t border-border px-3 py-2.5 shrink-0">
        {/* Theme toggle */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-ink-secondary hover:bg-surface-hover transition-colors mb-1"
          >
            {isDark ? <Sun size={15} className="shrink-0" /> : <Moon size={15} className="shrink-0" />}
            <span>{isDark ? '浅色模式' : '深色模式'}</span>
          </button>
        )}

        {/* Sync indicator */}
        <div className="flex items-center gap-2 px-2 py-1 mb-1">
          {user ? (
            <>
              <Cloud size={13} className="text-success" />
              <span className="text-xs text-ink-tertiary">已同步云端</span>
            </>
          ) : (
            <>
              <CloudOff size={13} className="text-ink-faint" />
              <span className="text-xs text-ink-faint">仅本地存储</span>
            </>
          )}
        </div>

        {/* User info + logout */}
        {user ? (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-accent-surface flex items-center justify-center shrink-0">
                <User size={12} className="text-accent" />
              </div>
              <span className="text-xs text-ink-secondary truncate">
                {user.email}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {onNavigateSettings && (
                <button
                  onClick={onNavigateSettings}
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
    </aside>
  );
}
