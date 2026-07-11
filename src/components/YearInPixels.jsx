import { useMemo, useState, memo } from 'react';
import { format, getDaysInMonth, differenceInCalendarDays, startOfYear, eachDayOfInterval } from 'date-fns';
import { MOODS, MOOD_KEYS, MOOD_EMPTY_COLOR, getDailyReminder } from '../lib/moods';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MAX_DAY = 31;

/**
 * Single pixel cell — memoized.
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
        className="w-[14px] h-[14px] sm:w-4 sm:h-4 rounded-[3px] transition-all duration-150
          hover:scale-[2.2] hover:z-20 hover:shadow-lg cursor-default"
        style={{ backgroundColor: bgColor, opacity: isEmpty ? 0.25 : 1 }}
      />
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30
          px-2.5 py-1.5 rounded-lg bg-zinc-900/95 border border-white/[0.08]
          backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]
          whitespace-nowrap pointer-events-none">
          <p className="text-[11px] font-medium text-zinc-200">
            {dateStr} {moodEmoji} {moodLabel}
          </p>
          {title && (
            <p className="text-[10px] text-zinc-400 mt-0.5 max-w-[160px] truncate">
              {title}
            </p>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
            border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900/95" />
        </div>
      )}
    </div>
  );
});

/**
 * Compute the longest consecutive-day streak from a set of recorded dates.
 */
function computeStreak(recordedDates) {
  if (recordedDates.size === 0) return 0;
  const today = new Date();
  const yearStart = startOfYear(today);
  const allDays = eachDayOfInterval({ start: yearStart, end: today });
  let maxStreak = 0;
  let currentStreak = 0;
  for (const day of allDays) {
    const key = `${day.getMonth()}_${day.getDate()}`;
    if (recordedDates.has(key)) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

/**
 * Generate a warm insight message based on the data.
 */
function generateInsight(stats, year) {
  const { moodCounts, total, longestStreak } = stats;
  if (total === 0) {
    return '新的一年，从记录第一篇心情开始吧 ✨';
  }

  // Find the dominant mood
  let dominantMood = null;
  let maxCount = 0;
  for (const [mood, count] of Object.entries(moodCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantMood = mood;
    }
  }

  const m = MOODS[dominantMood];
  const percentage = Math.round((maxCount / total) * 100);
  const month = new Date().getMonth();
  const season = month < 3 ? '初春' : month < 6 ? '盛夏' : month < 9 ? '金秋' : '寒冬';

  const lines = [];

  if (percentage > 40) {
    lines.push(`今年你最常感受到的是「${m.label}」的情绪（${percentage}%），${m.emoji}`);
  } else {
    lines.push(`今年你记录了 ${total} 天的心情，其中「${m.label}」最多（${maxCount}天），${m.emoji}`);
  }

  if (longestStreak >= 7) {
    lines.push(`最长连续记录 ${longestStreak} 天，这份坚持令人敬佩。`);
  } else if (longestStreak >= 3) {
    lines.push(`连续 ${longestStreak} 天的记录，是对自己温柔的关照。`);
  }

  const seasonMsg = month < 3
    ? `在这个${season}的季节里，愿你的每一天都如花般绽放 🌸`
    : month < 6
      ? `${season}的阳光正好，继续记录生活的温度吧 ☀️`
      : month < 9
        ? `${season}是收获的季节，你的每一篇日记都是珍贵的果实 🍂`
        : `${season}虽冷，但你的文字温暖了整个冬天 ❄️`;

  lines.push(seasonMsg);
  return lines.join(' ');
}

/**
 * Year in Pixels — Two-column Analytics Dashboard.
 *
 * Left:  13×32 precision pixel grid
 * Right: Key stats + mood distribution + warm insights
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
      if (!map[key] || new Date(entry.createdAt) > new Date(map[key].createdAt)) {
        map[key] = entry;
      }
    }
    return map;
  }, [entries, year]);

  // Stats — mood counts + streak
  const stats = useMemo(() => {
    const moodCounts = {};
    let total = 0;
    const recordedDates = new Set();
    for (const [key, entry] of Object.entries(entryMap)) {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      total++;
      recordedDates.add(key);
    }
    const longestStreak = computeStreak(recordedDates);
    return { moodCounts, total, longestStreak };
  }, [entryMap]);

  // Insight text
  const insight = useMemo(() => generateInsight(stats, year), [stats, year]);

  // Pre-compute days per month
  const daysInMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => getDaysInMonth(new Date(year, i))),
    [year],
  );

  // Mood distribution sorted by count (descending)
  const moodDistribution = useMemo(() => {
    return MOOD_KEYS
      .map((key) => ({
        key,
        ...MOODS[key],
        count: stats.moodCounts[key] || 0,
        pct: stats.total > 0 ? Math.round(((stats.moodCounts[key] || 0) / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  return (
    <div className="flex items-start justify-center min-h-[80vh] px-4 py-8">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-200 tracking-tight">
              {year} 年度情绪看板
            </h2>
            <p className="text-[11px] text-zinc-500 mt-1 tracking-wide">
              {reminder}
            </p>
          </div>
          <span className="text-[11px] text-zinc-600 tabular-nums">
            {stats.total} 篇
          </span>
        </div>

        {/* Two-column dashboard card */}
        <div className="bg-[#18181B]/40 border border-white/[0.04] backdrop-blur-md
          rounded-2xl p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.3)]
          grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8">

          {/* ─── Left Column: Pixel Grid (3/5) ─── */}
          <div className="md:col-span-3 overflow-x-auto scrollbar-none -mx-2 px-2">
            <div
              className="inline-grid gap-[3px]"
              style={{
                gridTemplateColumns: '28px repeat(12, 1fr)',
                gridTemplateRows: '20px repeat(31, auto)',
              }}
            >
              {/* Row 0: corner + month headers */}
              <div />
              {MONTHS.map((m) => (
                <div key={m} className="flex items-end justify-center pb-0.5">
                  <span className="text-[9px] text-zinc-500 font-medium tabular-nums">
                    {m}
                  </span>
                </div>
              ))}

              {/* Rows 1–31 */}
              {Array.from({ length: MAX_DAY }, (_, dayIdx) => {
                const day = dayIdx + 1;
                return [
                  <div key={`day-${day}`} className="flex items-center justify-end pr-1">
                    <span className="text-[9px] text-zinc-600 tabular-nums leading-none">
                      {day}
                    </span>
                  </div>,
                  ...Array.from({ length: 12 }, (_, monthIdx) => {
                    if (day > daysInMonths[monthIdx]) {
                      return <div key={`e-${monthIdx}`} />;
                    }
                    const date = new Date(year, monthIdx, day);
                    const key = `${monthIdx}_${day}`;
                    const entry = entryMap[key];
                    return (
                      <Pixel
                        key={`c-${monthIdx}`}
                        date={date}
                        mood={entry?.mood || null}
                        title={entry?.title || ''}
                        isEmpty={!entry}
                      />
                    );
                  }),
                ];
              })}
            </div>

            {/* Legend — mood pills */}
            <div className="mt-5 pt-4 border-t border-white/[0.04]">
              <div className="flex flex-wrap items-center gap-2">
                {MOOD_KEYS.map((key) => {
                  const mood = MOODS[key];
                  const count = stats.moodCounts[key] || 0;
                  return (
                    <div
                      key={key}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                        bg-white/[0.03] border border-white/[0.04]
                        transition-colors duration-150 hover:bg-white/[0.06]"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: mood.color }}
                      />
                      <span className="text-[10px] text-zinc-400">{mood.emoji}</span>
                      <span className="text-[10px] text-zinc-500 tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── Right Column: Analytics Panel (2/5) ─── */}
          <div className="md:col-span-2 flex flex-col gap-6">

            {/* Module A: Key Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
                <div className="text-2xl font-light text-zinc-200 tabular-nums tracking-tight font-serif">
                  {stats.total}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">已记录天数</div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
                <div className="text-2xl font-light text-zinc-200 tabular-nums tracking-tight font-serif">
                  {stats.longestStreak}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">最长连续天数</div>
              </div>
            </div>

            {/* Module B: Mood Distribution */}
            <div>
              <h3 className="text-[11px] font-medium text-zinc-400 mb-3 tracking-wide">
                情绪占比
              </h3>
              <div className="space-y-2.5">
                {moodDistribution.map(({ key, emoji, label, color, count, pct }) => (
                  <div key={key} className="flex items-center gap-3">
                    {/* Emoji + label */}
                    <div className="flex items-center gap-1.5 w-16 shrink-0">
                      <span className="text-sm">{emoji}</span>
                      <span className="text-[11px] text-zinc-400">{label}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex-1 h-[6px] bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                          opacity: pct > 0 ? 0.85 : 0,
                        }}
                      />
                    </div>

                    {/* Count + percentage */}
                    <div className="flex items-center gap-1.5 w-14 shrink-0 justify-end">
                      <span className="text-[10px] text-zinc-500 tabular-nums">{count}天</span>
                      {pct > 0 && (
                        <span className="text-[9px] text-zinc-600 tabular-nums">
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Module C: Warm Insight */}
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
              <h3 className="text-[11px] font-medium text-zinc-400 mb-2 tracking-wide">
                年度寄语
              </h3>
              <p className="text-[12px] text-zinc-300 leading-relaxed">
                {insight}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
