import { useRef, useCallback, useEffect, useState } from 'react';
import { Pin, Trash2, Star } from 'lucide-react';

/**
 * SwipeableRow — bidirectional swipe-to-action for mobile list items.
 *
 * Left swipe  → Pin + Delete buttons
 * Right swipe → Favorite button
 * Swipe past 70% width → instant delete on release
 *
 * Uses native touch events for 60fps follow-finger tracking.
 *
 * Props:
 *   - children: ReactNode (the list item content)
 *   - onPin: () => void
 *   - onDelete: () => void
 *   - onFavorite: () => void
 *   - isPinned: boolean
 *   - isFavorited: boolean
 *   - onDeleteComplete: () => void — called after collapse animation
 */
export default function SwipeableRow({
  children,
  onPin,
  onDelete,
  onFavorite,
  isPinned = false,
  isFavorited = false,
  onDeleteComplete,
}) {
  const rowRef = useRef(null);
  const contentRef = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef(null); // null = undetermined, true/false
  const [offset, setOffset] = useState(0);
  const [isCollapsing, setIsCollapsing] = useState(false);

  const BUTTON_WIDTH = 76; // width of each action button
  const LEFT_BUTTONS = 2;  // pin + delete
  const RIGHT_BUTTONS = 1; // favorite
  const MAX_LEFT = LEFT_BUTTONS * BUTTON_WIDTH;
  const MAX_RIGHT = RIGHT_BUTTONS * BUTTON_WIDTH;
  const DELETE_THRESHOLD = 0.7; // 70% of row width
  const ANGLE_THRESHOLD = 10;   // px — dead zone for horizontal detection
  const SNAP_THRESHOLD = BUTTON_WIDTH * 0.5; // snap open/closed at 50% of button width

  // Close on outside tap
  useEffect(() => {
    const handleClose = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setOffset(0);
      }
    };
    document.addEventListener('touchstart', handleClose, { passive: true });
    document.addEventListener('mousedown', handleClose);
    return () => {
      document.removeEventListener('touchstart', handleClose);
      document.removeEventListener('mousedown', handleClose);
    };
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (isCollapsing) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = touch.clientX;
    isDragging.current = false;
    isHorizontal.current = null;

    // Remove transition for instant follow-finger
    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
    }
  }, [isCollapsing]);

  const handleTouchMove = useCallback((e) => {
    if (isCollapsing) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // Determine gesture direction on first significant movement
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > ANGLE_THRESHOLD || Math.abs(dy) > ANGLE_THRESHOLD) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
        if (!isHorizontal.current) {
          // Vertical scroll — release control
          return;
        }
      } else {
        return; // Still within dead zone
      }
    }

    if (!isHorizontal.current) return;

    // We're swiping horizontally — prevent scroll
    e.preventDefault();
    isDragging.current = true;
    currentX.current = touch.clientX;

    // Apply resistance at edges
    let newOffset = dx;
    if (dx > 0 && offset >= MAX_RIGHT) {
      // Rubber band effect past max right
      newOffset = MAX_RIGHT + (dx - MAX_RIGHT) * 0.3;
    } else if (dx < 0 && offset <= -MAX_LEFT) {
      // Rubber band effect past max left
      newOffset = -MAX_LEFT + (dx + MAX_LEFT) * 0.3;
    }

    // Clamp with rubber band
    setOffset(newOffset);
  }, [offset, MAX_LEFT, MAX_RIGHT, isCollapsing]);

  const handleTouchEnd = useCallback(() => {
    if (isCollapsing) return;
    if (!isDragging.current) {
      setOffset(0);
      return;
    }

    const dx = currentX.current - startX.current;
    const rowWidth = rowRef.current?.offsetWidth || 300;

    // Add transition back for snap animation
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }

    // Check for extreme swipe → delete
    if (dx < -rowWidth * DELETE_THRESHOLD) {
      // Swipe left past 70% → collapse and delete
      setIsCollapsing(true);
      setOffset(-rowWidth);
      setTimeout(() => {
        onDelete?.();
        onDeleteComplete?.();
      }, 350);
      return;
    }

    // Snap logic
    if (dx < -SNAP_THRESHOLD) {
      // Snap to show left buttons
      setOffset(-MAX_LEFT);
    } else if (dx > SNAP_THRESHOLD) {
      // Snap to show right button
      setOffset(MAX_RIGHT);
    } else {
      // Snap back to closed
      setOffset(0);
    }

    isDragging.current = false;
    isHorizontal.current = null;
  }, [isCollapsing, onDelete, onDeleteComplete, MAX_LEFT, MAX_RIGHT, SNAP_THRESHOLD, DELETE_THRESHOLD]);

  const handleActionClick = useCallback((action) => {
    // Close the row first
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }
    setOffset(0);
    // Execute action after a brief delay so the animation starts
    setTimeout(() => action?.(), 50);
  }, []);

  return (
    <div
      ref={rowRef}
      className={`swipeable-row ${isCollapsing ? 'collapsing' : ''}`}
    >
      {/* Left action buttons (revealed on left swipe) */}
      <div className="swipe-actions-left" style={{ width: `${MAX_LEFT}px` }}>
        <button
          onClick={() => handleActionClick(onPin)}
          className="swipe-action-btn bg-blue-600/80 backdrop-blur-md"
          title={isPinned ? '取消置顶' : '置顶'}
        >
          <Pin size={16} className={isPinned ? 'fill-current' : ''} />
          <span className="text-[10px] mt-0.5">{isPinned ? '已置顶' : '置顶'}</span>
        </button>
        <button
          onClick={() => handleActionClick(onDelete)}
          className="swipe-action-btn bg-red-500/80 backdrop-blur-md"
          title="删除"
        >
          <Trash2 size={16} />
          <span className="text-[10px] mt-0.5">删除</span>
        </button>
      </div>

      {/* Right action button (revealed on right swipe) */}
      <div className="swipe-actions-right" style={{ width: `${MAX_RIGHT}px` }}>
        <button
          onClick={() => handleActionClick(onFavorite)}
          className="swipe-action-btn bg-amber-500/80 backdrop-blur-md"
          title={isFavorited ? '取消收藏' : '收藏'}
        >
          <Star size={16} className={isFavorited ? 'fill-current' : ''} />
          <span className="text-[10px] mt-0.5">{isFavorited ? '已收藏' : '收藏'}</span>
        </button>
      </div>

      {/* Main content — slides left/right */}
      <div
        ref={contentRef}
        className="swipeable-content"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
