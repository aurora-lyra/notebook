import { useRef, useCallback, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Pin, Trash2, Star } from 'lucide-react';

const BUTTON_W = 76;
const LEFT_W = BUTTON_W * 2;  // pin + delete
const RIGHT_W = BUTTON_W;     // favorite
const DELETE_RATIO = 0.7;
const SNAP_RATIO = 0.4;

/**
 * SwipeableRow — Apple-quality bidirectional swipe-to-action.
 *
 * Framer Motion spring physics for:
 *   - 60fps follow-finger drag
 *   - Elastic snap-back on release
 *   - Paper-fold collapse on extreme swipe delete
 *
 * Props:
 *   - children, onPin, onDelete, onFavorite, isPinned, isFavorited
 */
export default function SwipeableRow({
  children,
  onPin,
  onDelete,
  onFavorite,
  isPinned = false,
  isFavorited = false,
}) {
  const rowRef = useRef(null);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const x = useMotionValue(0);

  // Map drag offset to button opacity (reveal as you drag)
  const leftBtnOpacity = useTransform(x, [-LEFT_W, -BUTTON_W, 0], [1, 1, 0]);
  const rightBtnOpacity = useTransform(x, [0, BUTTON_W, RIGHT_W], [0, 1, 1]);

  // Close on outside tap
  const handleTapOutside = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
  }, [x]);

  const handleDragEnd = useCallback(
    (_, info) => {
      const dx = info.offset.x;
      const velocity = info.velocity.x;
      const rowW = rowRef.current?.offsetWidth || 300;

      // Extreme left swipe → collapse + delete
      if (dx < -rowW * DELETE_RATIO || velocity < -800) {
        setIsCollapsing(true);
        animate(x, -rowW, { type: 'spring', stiffness: 300, damping: 30 });
        setTimeout(() => onDelete?.(), 350);
        return;
      }

      // Snap logic based on offset + velocity
      if (dx < -LEFT_W * SNAP_RATIO || velocity < -300) {
        // Snap open left (show pin + delete)
        animate(x, -LEFT_W, { type: 'spring', stiffness: 400, damping: 30 });
      } else if (dx > RIGHT_W * SNAP_RATIO || velocity > 300) {
        // Snap open right (show favorite)
        animate(x, RIGHT_W, { type: 'spring', stiffness: 400, damping: 30 });
      } else {
        // Snap closed
        animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }
    },
    [x, onDelete],
  );

  const handleAction = useCallback(
    (action) => {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      setTimeout(() => action?.(), 80);
    },
    [x],
  );

  return (
    <motion.div
      ref={rowRef}
      className="swipeable-row"
      animate={isCollapsing ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      style={{ overflow: 'hidden' }}
    >
      {/* Left action buttons (behind content) */}
      <motion.div
        className="swipe-actions-left"
        style={{ width: LEFT_W, opacity: leftBtnOpacity }}
      >
        <button
          onClick={() => handleAction(onPin)}
          className="swipe-action-btn bg-blue-600/80 backdrop-blur-md"
        >
          <Pin size={16} className={isPinned ? 'fill-current' : ''} />
          <span className="text-[10px] mt-0.5">{isPinned ? '已置顶' : '置顶'}</span>
        </button>
        <button
          onClick={() => handleAction(onDelete)}
          className="swipe-action-btn bg-red-500/80 backdrop-blur-md"
        >
          <Trash2 size={16} />
          <span className="text-[10px] mt-0.5">删除</span>
        </button>
      </motion.div>

      {/* Right action button (behind content) */}
      <motion.div
        className="swipe-actions-right"
        style={{ width: RIGHT_W, opacity: rightBtnOpacity }}
      >
        <button
          onClick={() => handleAction(onFavorite)}
          className="swipe-action-btn bg-amber-500/80 backdrop-blur-md"
        >
          <Star size={16} className={isFavorited ? 'fill-current' : ''} />
          <span className="text-[10px] mt-0.5">{isFavorited ? '已收藏' : '收藏'}</span>
        </button>
      </motion.div>

      {/* Main content — draggable */}
      <motion.div
        className="swipeable-content"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -LEFT_W, right: RIGHT_W }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onTap={handleTapOutside}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
