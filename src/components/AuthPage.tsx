import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register' | 'recovery-code' | 'reset';

export function AuthPage() {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [resetUsername, setResetUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setRecoveryCode('');
    setCopied(false);
    setResetUsername('');
    setResetCode('');
    setResetNewPassword('');
    setResetSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('ユーザー名を入力してください'); return; }
    if (password.length < 6) { setError('パスワードは6文字以上で入力してください'); return; }
    if (mode === 'register') {
      if (password !== confirmPassword) { setError('パスワードが一致しません'); return; }
      if (username.length < 2 || username.length > 32) {
        setError('ユーザー名は2〜32文字で入力してください');
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login(username.trim(), password);
        if (result === 'invalid') setError('ユーザー名またはパスワードが正しくありません');
      } else {
        const result = await register(username.trim(), password);
        if (result.status === 'taken') {
          setError('このユーザー名はすでに使用されています');
        } else if (result.status === 'server_error') {
          setError('サーバーエラーが発生しました。しばらく経ってから再度お試しください');
        } else if (result.status === 'ok') {
          setRecoveryCode(result.recoveryCode);
          setMode('recovery-code');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!resetUsername.trim()) { setError('ユーザー名を入力してください'); return; }
    if (!resetCode.trim()) { setError('リカバリーコードを入力してください'); return; }
    if (resetNewPassword.length < 6) { setError('新しいパスワードは6文字以上で入力してください'); return; }
    setLoading(true);
    try {
      const result = await resetPassword(resetUsername.trim(), resetCode.trim(), resetNewPassword);
      if (result === 'ok') {
        setResetSuccess(true);
      } else if (result === 'no_recovery_code') {
        setError('リカバリーコードが設定されていません。ログイン後、アカウント設定から生成してください');
      } else {
        setError('ユーザー名またはリカバリーコードが正しくありません');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 手動コピー */ }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">
        <div style={{ fontSize: '3rem', marginBottom: '6px' }}>✓</div>
        <h1 className="auth-title">TaskVon</h1>
        <p className="auth-sub">毎日のタスクをシンプルに管理</p>
      </div>

      <div className="auth-card">
        {/* ログイン・登録タブ */}
        {(mode === 'login' || mode === 'register') && (
          <div className="auth-tabs">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                className={`auth-tab${mode === m ? ' on' : ''}`}
                onClick={() => switchMode(m)}
              >
                {m === 'login' ? 'ログイン' : '新規登録'}
              </button>
            ))}
          </div>
        )}

        {/* ログイン・登録フォーム */}
        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-fg">
              <label className="auth-lbl" htmlFor="auth-username">ユーザー名</label>
              <input
                id="auth-username"
                className="fi auth-input"
                type="text"
                autoComplete={mode === 'login' ? 'username' : 'new-password'}
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="例: yamada_taro"
                autoFocus
              />
            </div>
            <div className="auth-fg">
              <label className="auth-lbl" htmlFor="auth-password">パスワード</label>
              <input
                id="auth-password"
                className="fi auth-input"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="6文字以上"
              />
            </div>
            {mode === 'register' && (
              <div className="auth-fg">
                <label className="auth-lbl" htmlFor="auth-confirm">パスワード（確認）</label>
                <input
                  id="auth-confirm"
                  className="fi auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="もう一度入力"
                />
              </div>
            )}
            {error && <div className="auth-error">⚠ {error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
            </button>
          </form>
        )}

        {/* リカバリーコード表示 */}
        {mode === 'recovery-code' && (
          <div>
            <h2 className="auth-h2">🔑 リカバリーコード</h2>
            <p className="auth-note">パスワードを忘れた際に使用するコードです。</p>
            <p className="auth-note auth-warn">⚠ このコードは二度と表示されません。必ず安全な場所に保存してください。</p>
            <div className="auth-code-box">
              <code className="auth-code">{recoveryCode}</code>
            </div>
            <button type="button" className="auth-copy" onClick={handleCopy}>
              {copied ? '✓ コピーしました' : '📋 コードをコピー'}
            </button>
            <button
              type="button"
              className="auth-submit"
              onClick={() => switchMode('login')}
            >
              保存しました → アプリへ
            </button>
          </div>
        )}

        {/* パスワードリセットフォーム */}
        {mode === 'reset' && !resetSuccess && (
          <form onSubmit={handleResetSubmit} noValidate>
            <h2 className="auth-h2">🔓 パスワードをリセット</h2>
            <div className="auth-fg">
              <label className="auth-lbl" htmlFor="reset-username">ユーザー名</label>
              <input
                id="reset-username"
                className="fi auth-input"
                type="text"
                autoComplete="username"
                value={resetUsername}
                onChange={e => { setResetUsername(e.target.value); setError(''); }}
                placeholder="例: yamada_taro"
                autoFocus
              />
            </div>
            <div className="auth-fg">
              <label className="auth-lbl" htmlFor="reset-code">リカバリーコード</label>
              <input
                id="reset-code"
                className="fi auth-input"
                type="text"
                autoComplete="off"
                value={resetCode}
                onChange={e => { setResetCode(e.target.value); setError(''); }}
                placeholder="登録時に表示された24文字のコード"
              />
            </div>
            <div className="auth-fg">
              <label className="auth-lbl" htmlFor="reset-new-pw">新しいパスワード</label>
              <input
                id="reset-new-pw"
                className="fi auth-input"
                type="password"
                autoComplete="new-password"
                value={resetNewPassword}
                onChange={e => { setResetNewPassword(e.target.value); setError(''); }}
                placeholder="6文字以上"
              />
            </div>
            {error && <div className="auth-error">⚠ {error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '処理中...' : 'パスワードをリセット'}
            </button>
            <p className="auth-hint">
              <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                ← ログインに戻る
              </button>
            </p>
          </form>
        )}

        {/* リセット成功 */}
        {mode === 'reset' && resetSuccess && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✓</div>
            <p className="auth-h2">パスワードを変更しました</p>
            <p className="auth-note" style={{ marginBottom: '20px' }}>新しいパスワードでログインしてください</p>
            <button type="button" className="auth-submit" onClick={() => switchMode('login')}>
              ログインへ
            </button>
          </div>
        )}

        {/* ヒントリンク */}
        <p className="auth-hint">
          {mode === 'login' ? (
            <>
              アカウントをお持ちでない方は{' '}
              <button className="auth-link" onClick={() => switchMode('register')}>新規登録</button>
              <br />
              <button
                className="auth-link"
                style={{ marginTop: '6px', display: 'inline-block' }}
                onClick={() => switchMode('reset')}
              >
                パスワードを忘れた方はこちら
              </button>
            </>
          ) : mode === 'register' ? (
            <>
              すでにアカウントをお持ちの方は{' '}
              <button className="auth-link" onClick={() => switchMode('login')}>ログイン</button>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
