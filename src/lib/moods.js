/**
 * Mood configuration for Year in Pixels.
 * Macaron color palette — soft, warm, pastel tones.
 */
export const MOODS = {
  happy:    { label: '喜', emoji: '😊', color: '#f6d365', bg: 'bg-[#f6d365]' },
  calm:     { label: '平', emoji: '🍃', color: '#a8d8b9', bg: 'bg-[#a8d8b9]' },
  sad:      { label: '哀', emoji: '😢', color: '#9bbbd4', bg: 'bg-[#9bbbd4]' },
  anxious:  { label: '虑', emoji: '😰', color: '#c5a3d9', bg: 'bg-[#c5a3d9]' },
  angry:    { label: '怒', emoji: '😤', color: '#e8a0a0', bg: 'bg-[#e8a0a0]' },
  love:     { label: '爱', emoji: '❤️', color: '#f2b5d4', bg: 'bg-[#f2b5d4]' },
  inspired: { label: '灵', emoji: '✨', color: '#b8d4e3', bg: 'bg-[#b8d4e3]' },
  tired:    { label: '倦', emoji: '😴', color: '#c4b5a0', bg: 'bg-[#c4b5a0]' },
};

export const MOOD_KEYS = Object.keys(MOODS);

export const MOOD_EMPTY_COLOR = '#2a2a2e'; // very faint dark gray for empty days

/**
 * Warm reminder messages — shown randomly in the Year in Pixels header.
 */
export const REMINDERS = [
  '每一天都值得被记住 ✨',
  '你的感受，都是珍贵的 🌸',
  '回头看，你会发现成长的痕迹 🌱',
  '记录本身就是一种温柔 📖',
  '今天也辛苦啦 ☀️',
  '慢慢来，比较快 🍃',
  '你已经很棒了 💛',
  '情绪没有对错，都是真实的自己 🌈',
  '写下来的梦，更容易实现 🌙',
  '每一页都是独一无二的你 🦋',
];

/**
 * Get a deterministic "random" reminder based on the current date.
 * Changes once per day.
 */
export function getDailyReminder() {
  const today = new Date();
  const dayIndex = today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate();
  return REMINDERS[dayIndex % REMINDERS.length];
}
