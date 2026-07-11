import { useState } from 'react';
import { LogIn, UserPlus, Loader2, WifiOff, AlertTriangle } from 'lucide-react';

/**
 * Auth screen — login / register.
 */
export default function AuthScreen({ onSignIn, onSignUp, onSkip, connectionError }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (err) {
      setLocalError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const hasConnectionIssue = !!connectionError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-ink tracking-tight">
            Notebook
          </h1>
          <p className="text-sm text-ink-tertiary mt-2">
            {mode === 'login' ? '登录你的账号' : '创建新账号'}
          </p>
        </div>

        {/* Connection warning */}
        {hasConnectionIssue && (
          <div className="mb-5 p-3 rounded-lg bg-warning-surface border border-warning/20 flex items-start gap-2.5">
            <WifiOff size={16} className="text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink">无法连接到云端</p>
              <p className="text-xs text-ink-secondary mt-1">
                {connectionError === '连接超时，请检查网络'
                  ? 'Supabase 服务响应超时，可能是网络限制导致。'
                  : connectionError}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-ink-secondary mb-1.5">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg outline-none focus:border-accent transition-colors text-ink placeholder:text-ink-faint"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-secondary mb-1.5">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="至少 6 位"
              className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg outline-none focus:border-accent transition-colors text-ink placeholder:text-ink-faint"
            />
          </div>

          {/* Error */}
          {(localError || (!hasConnectionIssue && connectionError)) && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-danger-surface">
              <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
              <p className="text-xs text-danger">
                {localError || connectionError}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-ink text-surface text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn size={15} />
                登录
              </>
            ) : (
              <>
                <UserPlus size={15} />
                注册
              </>
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="text-center mt-4">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setLocalError('');
            }}
            className="text-xs text-ink-tertiary hover:text-accent transition-colors"
          >
            {mode === 'login'
              ? '没有账号？点击注册'
              : '已有账号？点击登录'}
          </button>
        </div>

        {/* Skip — use local only (more prominent when connection fails) */}
        {onSkip && (
          <div className={`text-center mt-6 pt-4 border-t border-border ${hasConnectionIssue ? 'animate-pulse' : ''}`}>
            <button
              onClick={onSkip}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors
                ${hasConnectionIssue
                  ? 'bg-ink text-surface font-medium hover:opacity-90'
                  : 'text-ink-faint hover:text-ink-tertiary'
                }`}
            >
              {hasConnectionIssue ? '进入离线模式' : '跳过登录，仅本地使用'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
