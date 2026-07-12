import { memo, useMemo } from 'react';
import { format } from 'date-fns';
import { Pin, Star, Trash2 } from 'lucide-react';

/**
 * Extract a plain-text preview from TipTap JSON content.
 */
function contentPreview(content, maxLen = 80) {
  if (!content?.content) return '';
  const text = content.content
    .map((node) =>
      node.content?.map((n) => n.text || '').join('') || '',
    )
    .join(' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

/**
 * Memoized entry row — only re-renders when its own data or active state changes.
 */
const EntryRow = memo(function EntryRow({
  entry,
  isActive,
  onSelect,
  onTogglePin,
  onToggleFav,
  onDelete,
}) {
  const preview = useMemo(() => contentPreview(entry.content), [entry.content]);
  const dateStr = useMemo(
    () => format(new Date(entry.updatedAt), 'MM/dd HH:mm'),
    [entry.updatedAt],
  );

  return (
    <div
      onClick={() => onSelect(entry.id)}
      className={`group px-4 py-3 cursor-pointer border-b border-border transition-colors
        ${isActive
          ? 'bg-surface-active'
          : 'hover:bg-surface-hover'
        }`}
    >
      {/* Cover */}
      {entry.coverUrl && (
        <div className="mb-2 rounded-md overflow-hidden h-24 bg-surface-active">
          <img
            src={entry.coverUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Title */}
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-sm font-medium text-ink leading-snug line-clamp-1">
          {entry.title || '无标题'}
        </h3>
        {entry.pinned && (
          <Pin size={12} className="text-ink-tertiary mt-0.5 shrink-0" />
        )}
      </div>

      {/* Preview */}
      <p className="text-xs text-ink-tertiary mt-1 line-clamp-2 leading-relaxed">
        {preview}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-ink-faint">{dateStr}</span>

        {/* Actions (show on hover, always visible on touch) */}
        <div className="entry-row-actions flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            title={entry.favorited ? '取消收藏' : '收藏'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav(entry.id);
            }}
            className="p-1 rounded hover:bg-surface-active transition-colors"
          >
            <Star
              size={13}
              className={entry.favorited ? 'text-warning fill-warning' : 'text-ink-tertiary'}
            />
          </button>
          <button
            title={entry.pinned ? '取消置顶' : '置顶'}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(entry.id);
            }}
            className="p-1 rounded hover:bg-surface-active transition-colors"
          >
            <Pin
              size={13}
              className={entry.pinned ? 'text-accent' : 'text-ink-tertiary'}
            />
          </button>
          <button
            title="删除"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry.id);
            }}
            className="p-1 rounded hover:bg-danger-surface transition-colors"
          >
            <Trash2 size={13} className="text-ink-tertiary hover:text-danger" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {entry.tags.map((t) => (
            <span
              key={t}
              className="text-xs px-1.5 py-0.5 rounded bg-accent-surface text-accent"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Entry list panel.
 */
export default memo(function EntryList({
  entries,
  activeId,
  onSelect,
  onTogglePin,
  onToggleFav,
  onDelete,
}) {
  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-tertiary text-sm">
        暂无内容
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {entries.map((entry) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          isActive={activeId === entry.id}
          onSelect={onSelect}
          onTogglePin={onTogglePin}
          onToggleFav={onToggleFav}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
});
