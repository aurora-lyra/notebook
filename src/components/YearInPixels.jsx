import { useMemo, useState, memo } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { MOODS, MOOD_EMPTY_COLOR, getDailyReminder } from '../lib/moods';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MAX_DAY = 31;

/**
 * Single pixel cell — memoized to avoid unnecessary re-renders.
 */
const Pixel = memo(function Pixel({ date, mood, title, isEmpty }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const bgColor = mood ? MOODS[mood]?.color : MOOD_EMPTY_COLOR;
  const moodLabel = mood ? MOODS[mood]?.label : '未记录';
  const moodEmoji = mood ? MOODS[mood]?.emoji : '';
  const dateStr = format(date, 'M月d日');

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[2px] transition-transform duration-150
          hover:scale-150 hover:z-10 cursor-default
          ${isEmpty ? 'opacity-30' : ''}`}
        style={{ backgroundColor: bgColor }}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20
          px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border shadow-md
          whitespace-nowrap pointer-events-none">
          <p className="text-[11px] font-medium text-ink">
            {dateStr} {moodEmoji} {moodLabel}
          </p>
          {title && (
            <p className="text-[10px] text-ink-tertiary mt-0.5 max-w-[160px] truncate">
              {title}
            </p>
          )}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
            border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-raised" />
        </div>
      )}
    </div>
  );
});

/**
 * Year in Pixels — 12×31 mood grid for the current year.
 *
 * Props:
 *   - entries: diary entries array (must have mood + createdAt + title)
 */
export default function YearInPixels({ entries }) {
  const year = new Date().getFullYear();
  const reminder = useMemo(getDailyReminder, []);

  // Build a date→entry map for fast lookup
  const entryMap = useMemo(() => {
    const map = {};
    for (const entry of entries) {
      if (!entry.mood) continue;
      const d = new Date(entry.createdAt);
      if (d.getFullYear() !== year) continue;
      const key = `${d.getMonth()}_${d.getDate()}`;
      // Keep the latest entry per day
      if (!map[key] || new Date(entry.createdAt) > new Date(map[key].createdAt)) {
        map[key] = entry;
      }
    }
    return map;
  }, [entries, year]);

  // Stats
  const stats = useMemo(() => {
    const moodCounts = {};
    let total = 0;
    for (const entry of Object.values(entryMap)) {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      total++;
    }
    return { moodCounts, total };
  }, [entryMap]);

  return (
    <div className="px-4 md:px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{year} 心情像素画</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">{reminder}</p>
        </div>
        <span className="text-xs text-ink-faint">{stats.total} 篇日记</span>
      </div>

      {/* Grid container — horizontal scroll on mobile */}
      <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
        <div className="inline-flex flex-col gap-0.5">
          {/* Month labels */}
          <div className="flex gap-0.5 ml-5 mb-0.5">
            {MONTHS.map((m) => (
              <div
                key={m}
                className="text-[9px] text-ink-faint text-center shrink-0"
                style={{ width: `${getDaysInMonth(new Date(year, MONTHS.indexOf(m))) * 14 + (getDaysInMonth(new Date(year, MONTHS.indexOf(m))) - 1) * 2}px` }}
              >
                {m}
              </div>
            ))}
          </div>

          {/* Rows: one per day (1-31) */}
          {Array.from({ length: MAX_DAY }, (_, dayIdx) => {
            const day = dayIdx + 1;
            return (
              <div key={day} className="flex items-center gap-0.5">
                {/* Day label */}
                <span className="text-[9px] text-ink-faint w-4 text-right shrink-0 tabular-nums">
                  {day}
                </span>

                {/* 12 months */}
                {Array.from({ length: 12 }, (_, monthIdx) => {
                  const daysInMonth = getDaysInMonth(new Date(year, monthIdx));
                  if (day > daysInMonth) {
                    // Empty placeholder for months without this day
                    return <div key={monthIdx} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />;
                  }
                  const date = new Date(year, monthIdx, day);
                  const key = `${monthIdx}_${day}`;
                  const entry = entryMap[key];

                  return (
                    <Pixel
                      key={monthIdx}
                      date={date}
                      mood={entry?.mood || null}
                      title={entry?.title || ''}
                      isEmpty={!entry}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {stats.total > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
          {Object.entries(stats.moodCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([mood, count]) => (
              <div key={mood} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-[2px]"
                  style={{ backgroundColor: MOODS[mood]?.color }}
                />
                <span className="text-[10px] text-ink-tertiary">
                  {MOODS[mood]?.label} {count}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
