import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Settings,
  BarChart3,
  Lock,
  Type,
  Moon,
  HardDrive,
  Download,
  BookOpen,
  Calendar,
  Hash,
  TrendingUp,
  Cloud,
  Loader2,
} from 'lucide-react';
import { MOODS, MOOD_KEYS } from '../lib/moods';
import { useEntries } from '../hooks/useEntries';
import { serialize } from '../lib/markdown';

const TABS = [
  { id: 'settings', label: '个人设置', icon: Settings },
  { id: 'stats', label: '时光复盘', icon: BarChart3 },
];

/**
 * Calculate consecutive writing days (streak).
 */
function calcStreak(entries) {
  if (!entries.length) return 0;
  const days = new Set(
    entries.map((e) => format(new Date(e.createdAt), 'yyyy-MM-dd')),
  );
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = format(d, 'yyyy-MM-dd');
    if (days.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Extract word frequency from diary content.
 */
function getWordFrequency(entries, topN = 12) {
  const stopWords = new Set([
    '的', '了', '是', '我', '在', '和', '就', '都', '而', '及', '与', '着',
    '或', '一个', '没有', '我们', '你们', '他们', '这个', '那个', '什么',
    '怎么', '但是', '如果', '因为', '所以', '可以', '不是', '已经', '这样',
    '那样', '还是', '只是', '不过', '然后', '自己', '一些', '这种', '那种',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'it', 'this', 'that',
    'i', 'he', 'she', 'they', 'we', 'you', 'and', 'but', 'or', 'not', 'so',
  ]);

  const freq = {};
  for (const entry of entries) {
    if (!entry.content?.content) continue;
    const text = entry.content.content
      .map((node) => node.content?.map((n) => n.text || '').join('') || '')
      .join(' ');
    const words = text.match(/[一-鿿]|[a-zA-Z]+/g) || [];
    for (const word of words) {
      const lower = word.toLowerCase();
      if (lower.length < 2 || stopWords.has(lower)) continue;
      freq[lower] = (freq[lower] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

/**
 * Settings & Dashboard — two-tab design.
 */
export default function SettingsPage({
  user,
  isDark,
  onToggleTheme,
  onChangePassword,
  onClose,
  onBatchUpload,
  syncVersion = 0,
}) {
  const [activeTab, setActiveTab] = useState('settings');

  const { entries } = useEntries({ type: 'diary' }, syncVersion);

  // Stats
  const stats = useMemo(() => {
    const totalEntries = entries.length;
    const totalWords = entries.reduce((sum, e) => {
      if (!e.content?.content) return sum;
      const text = e.content.content
        .map((n) => n.content?.map((t) => t.text || '').join('') || '')
        .join('');
      return sum + text.length;
    }, 0);
    const streak = calcStreak(entries);
    const wordFreq = getWordFrequency(entries);

    // Mood distribution
    const moodCounts = {};
    for (const e of entries) {
      if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    }
    const moodTotal = Object.values(moodCounts).reduce((a, b) => a + b, 0);

    return { totalEntries, totalWords, streak, wordFreq, moodCounts, moodTotal };
  }, [entries]);

  // Export all diaries
  const handleExportAll = useCallback(() => {
    const lines = entries.map((e) => {
      const date = format(new Date(e.createdAt), 'yyyy-MM-dd');
      const title = e.title || '无标题';
      const content = serialize(e.content);
      return `# ${title}\n\n> ${date}\n\n${content}`;
    });
    const blob = new Blob([lines.join('\n\n---\n\n')], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diary-export-${format(new Date(), 'yyyy-MM-dd')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [entries]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-medium text-ink">设置与统计</h1>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-ink-tertiary hover:text-ink rounded-md hover:bg-surface-hover transition-colors"
          >
            返回
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`settings-tab flex items-center gap-1.5 ${
                activeTab === id ? 'active' : ''
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'settings' ? (
          <SettingsTab
            user={user}
            isDark={isDark}
            onToggleTheme={onToggleTheme}
            onChangePassword={onChangePassword}
            onExportAll={handleExportAll}
            onBatchUpload={onBatchUpload}
            entryCount={entries.length}
          />
        ) : (
          <StatsTab stats={stats} />
        )}
      </div>
    </div>
  );
}

function SettingsTab({ user, isDark, onToggleTheme, onChangePassword, onExportAll, onBatchUpload, entryCount }) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const handleBatchUpload = useCallback(async () => {
    if (!onBatchUpload) return;
    setUploading(true);
    setUploadResult(null);
    try {
      await onBatchUpload();
      setUploadResult('success');
    } catch (err) {
      setUploadResult('error');
      console.error('Batch upload failed:', err);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadResult(null), 3000);
    }
  }, [onBatchUpload]);

  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
      {/* Account */}
      <Section title="账户" icon={Lock}>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-ink">{user?.email || '未登录'}</p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              {user ? '已同步云端' : '仅本地存储'}
            </p>
          </div>
          {user && onChangePassword && (
            <button
              onClick={onChangePassword}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              修改密码
            </button>
          )}
        </div>
      </Section>

      {/* Appearance */}
      <Section title="外观" icon={Type}>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-ink">深色模式</p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              {isDark ? '月之静谧' : '日光素笺'}
            </p>
          </div>
          <button
            onClick={onToggleTheme}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
              isDark ? 'bg-accent' : 'bg-border-strong'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                isDark ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </Section>

      {/* Storage */}
      <Section title="存储" icon={HardDrive}>
        <div className="py-2 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink">日记数量</p>
            <span className="text-sm text-ink-secondary">{entryCount} 篇</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink">存储位置</p>
            <span className="text-sm text-ink-secondary">
              {user ? 'Supabase + 本地' : '仅本地'}
            </span>
          </div>
          {user && onBatchUpload && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-ink-tertiary mb-2">
                将所有已发布条目同步到云端
              </p>
              <button
                onClick={handleBatchUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg
                  bg-accent text-white hover:opacity-90 transition-opacity
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Cloud size={14} />
                )}
                <span>{uploading ? '上传中…' : '批量上传到云端'}</span>
              </button>
              {uploadResult === 'success' && (
                <p className="text-xs text-green-400 mt-2">上传完成</p>
              )}
              {uploadResult === 'error' && (
                <p className="text-xs text-red-400 mt-2">上传失败，请重试</p>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Export */}
      <Section title="数据" icon={Download}>
        <div className="py-2">
          <p className="text-xs text-ink-tertiary mb-3">
            导出所有日记为 Markdown 文件，方便备份和迁移。
          </p>
          <button
            onClick={onExportAll}
            className="px-4 py-2 text-sm rounded-lg bg-ink text-surface hover:opacity-90 transition-opacity"
          >
            导出全部日记
          </button>
        </div>
      </Section>
    </div>
  );
}

function StatsTab({ stats }) {
  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-8">
      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card text-center">
          <div className="stat-value">{stats.totalEntries}</div>
          <div className="stat-label">篇日记</div>
        </div>
        <div className="stat-card text-center">
          <div className="stat-value">
            {stats.totalWords > 10000
              ? `${(stats.totalWords / 10000).toFixed(1)}万`
              : stats.totalWords.toLocaleString()}
          </div>
          <div className="stat-label">累计字数</div>
        </div>
        <div className="stat-card text-center">
          <div className="stat-value">{stats.streak}</div>
          <div className="stat-label">连续打卡</div>
        </div>
      </div>

      {/* Mood distribution */}
      {stats.moodTotal > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-ink-tertiary" />
            <h3 className="text-sm font-medium text-ink">心情分布</h3>
          </div>

          {/* Bar */}
          <div className="mood-bar flex mb-3">
            {MOOD_KEYS.filter((k) => stats.moodCounts[k]).map((k) => (
              <div
                key={k}
                className="mood-bar-segment"
                style={{
                  width: `${((stats.moodCounts[k] || 0) / stats.moodTotal) * 100}%`,
                  backgroundColor: MOODS[k].color,
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {MOOD_KEYS.filter((k) => stats.moodCounts[k])
              .sort((a, b) => stats.moodCounts[b] - stats.moodCounts[a])
              .map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: MOODS[k].color }}
                  />
                  <span className="text-xs text-ink-secondary">
                    {MOODS[k].emoji} {MOODS[k].label} {stats.moodCounts[k]}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Word frequency */}
      {stats.wordFreq.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Hash size={14} className="text-ink-tertiary" />
            <h3 className="text-sm font-medium text-ink">高频词汇</h3>
          </div>

          <div className="space-y-2">
            {stats.wordFreq.map(([word, count], i) => {
              const maxCount = stats.wordFreq[0][1];
              return (
                <div key={word} className="flex items-center gap-3">
                  <span className="text-xs text-ink-tertiary w-6 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-sm text-ink w-16 truncate">{word}</span>
                  <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/30"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-faint w-8 text-right tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.totalEntries === 0 && (
        <div className="text-center py-12">
          <Calendar size={32} className="mx-auto text-ink-faint mb-3" />
          <p className="text-sm text-ink-tertiary">还没有日记数据</p>
          <p className="text-xs text-ink-faint mt-1">开始写日记，这里会展示你的时光复盘</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-ink-tertiary" />
        <h3 className="text-xs font-medium text-ink-tertiary uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="rounded-xl border border-border px-4 py-1">{children}</div>
    </div>
  );
}
