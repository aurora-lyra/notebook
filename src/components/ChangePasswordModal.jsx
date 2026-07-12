import { useState, useRef, useEffect } from 'react';
import { X, Lock, Eye, EyeOff } from 'lucide-react';

/**
 * Change password modal — backdrop blur, minimal design.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - onSubmit: (newPassword) => Promise<{ error?: string }>
 *   - onSignOut: () => void — called after successful password change
 */
export default function ChangePasswordModal({ open, onClose, onSubmit, onSignOut }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const currentRef = useRef(null);

  // Focus first input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => currentRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess(false);
      setLoading(false);
      setShowCurrent(false);
      setShowNew(false);
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword === currentPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit(currentPassword, newPassword);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setSuccess(true);
      // Auto sign out after 2 seconds
      setTimeout(() => {
        onSignOut?.();
      }, 2000);
    } catch (err) {
      setError(err.message || '修改失败，请重试');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-sm bg-surface-raised border border-border rounded-xl shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="change-password-title" className="text-sm font-semibold text-ink">修改密码</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="p-2 rounded-md text-ink-tertiary hover:bg-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="px-5 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-success-surface mx-auto mb-3 flex items-center justify-center">
              <Lock size={20} className="text-success" />
            </div>
            <p className="text-sm font-medium text-ink mb-1">密码修改成功</p>
            <p className="text-xs text-ink-tertiary">正在退出登录，请使用新密码重新登录…</p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            {/* Error */}
            {error && (
              <div className="px-3 py-2 rounded-md bg-danger-surface text-danger text-xs">
                {error}
              </div>
            )}

            {/* Current password */}
            <div>
              <label className="block text-xs text-ink-tertiary mb-1">当前密码</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-hover border border-transparent focus-within:border-border transition-colors">
                <Lock size={14} className="text-ink-faint shrink-0" />
                <input
                  ref={currentRef}
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="输入当前密码"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? '隐藏密码' : '显示密码'}
                  className="p-2 -m-2 text-ink-faint hover:text-ink-tertiary transition-colors"
                >
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs text-ink-tertiary mb-1">新密码</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-hover border border-transparent focus-within:border-border transition-colors">
                <Lock size={14} className="text-ink-faint shrink-0" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? '隐藏密码' : '显示密码'}
                  className="p-2 -m-2 text-ink-faint hover:text-ink-tertiary transition-colors"
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs text-ink-tertiary mb-1">确认新密码</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-hover border border-transparent focus-within:border-border transition-colors">
                <Lock size={14} className="text-ink-faint shrink-0" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-4 py-2.5 rounded-lg bg-ink text-surface text-sm font-medium
                hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? '保存中…' : '保存修改'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
