import { BookOpen, CheckSquare } from 'lucide-react';

const TYPES = [
  { id: 'diary', label: '日记', icon: BookOpen },
  { id: 'memo', label: '备忘录', icon: CheckSquare },
];

/**
 * TypeToggle — minimal pill toggle between diary and memo types.
 * Clicking changes the entry's type in the database,
 * causing the editor UI to morph between text editor and checklist.
 *
 * Props:
 *   - type: 'diary' | 'memo'
 *   - onChange: (type) => void
 */
export default function TypeToggle({ type, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full
      bg-zinc-900/30 border border-white/[0.04] backdrop-blur-md">
      {TYPES.map(({ id, label, icon: Icon }) => {
        const isActive = type === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full
              text-xs font-medium transition-all duration-200 select-none
              ${
                isActive
                  ? 'bg-white/[0.08] text-zinc-200 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              }`}
          >
            <Icon size={12} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
