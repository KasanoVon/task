import { useState, useRef, useEffect } from 'react';
import { usePush } from '../hooks/usePush';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function AccountModal({ onClose }: { onClose: () => void }) {
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      const r = await fetch(`${API_BASE}/api/auth/setup-recovery-code`, {
        method: 'POST', credentials: 'include',
      });
      if (!r.ok) throw new Error();
      const { recoveryCode: code } = await r.json();
      setRecoveryCode(code);
      setCopied(false);
    } catch { alert('生成に失敗しました'); }
    finally { setGenerating(false); }
  }

  function copy() {
    if (!recoveryCode) return;
    navigator.clipboard.writeText(recoveryCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '20px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C7B6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A' }}>アカウント設定</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* リカバリーコード */}
        <div style={{ background: '#faf8f5', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '15px' }}>🔑</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A' }}>リカバリーコード</span>
          </div>
          <p style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.7, margin: '0 0 12px' }}>
            パスワードを忘れた際にアカウントを復旧するためのコードです。コードは1回しか表示されないため、必ず安全な場所に保存してください。
          </p>

          {/* 生成されたコード */}
          {recoveryCode && (
            <div style={{ background: '#fff', border: '1.5px solid #D4916E', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <code style={{ fontSize: '13px', fontFamily: 'monospace', color: '#8C4A2B', letterSpacing: '0.05em', flex: 1, wordBreak: 'break-all' }}>{recoveryCode}</code>
              <button onClick={copy} style={{ flexShrink: 0, fontSize: '11px', padding: '4px 10px', borderRadius: '999px', border: '1px solid #D4916E', background: copied ? '#D4916E' : '#fff', color: copied ? '#fff' : '#D4916E', cursor: 'pointer', fontWeight: 600, transition: 'all .2s' }}>
                {copied ? 'コピー済' : 'コピー'}
              </button>
            </div>
          )}

          {/* 生成ボタン */}
          <button onClick={generate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: generating ? 'wait' : 'pointer', fontSize: '13px', color: '#D4916E', fontWeight: 600 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#D4916E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M14 8A6 6 0 1 1 8 2"/><polyline points="14,2 14,8 8,8"/>
            </svg>
            {recoveryCode ? 'コードを再生成' : 'コードを生成 / 再生成'}
          </button>
          <p style={{ fontSize: '11px', color: '#B4AFA9', margin: '6px 0 0' }}>※ 再生成すると以前のコードは無効になります</p>
        </div>

        {/* 閉じる */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '999px', border: '1px solid #D0CCC7', background: '#fff', fontSize: '13px', color: '#6B6560', cursor: 'pointer', fontWeight: 500 }}>閉じる</button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface Props {
  username: string;
  onLogout: () => void;
}

export function UserMenu({ username, onLogout }: Props) {
  const { supported: pushSupported, loading: pushLoading, prefs, prefsLoading, setPref } = usePush();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  function exportCSV() {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/tasks/export`;
    a.download = '';
    a.click();
    setMenuOpen(false);
  }

  return (
    <>
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}

      <div ref={menuRef} style={{ position: 'relative' }}>
        {/* トリガー */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '999px', padding: '4px 10px 4px 6px', cursor: 'pointer' }}
        >
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {username.charAt(0).toUpperCase()}
          </span>
          <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>{username}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
            <polyline points="2,3.5 5,6.5 8,3.5" />
          </svg>
        </button>

        {/* ドロップダウン */}
        {menuOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', minWidth: '210px', overflow: 'hidden', zIndex: 100 }}>
            {/* ユーザー情報 */}
            <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f0ebe3' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1A1A1A' }}>{username}</div>
              <div style={{ fontSize: '11px', color: '#B4AFA9', marginTop: '1px' }}>としてログイン中</div>
            </div>

            {/* 通知設定 */}
            {pushSupported && (
              <div style={{ borderBottom: '1px solid #f5f0eb' }}>
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#B4AFA9', letterSpacing: '.04em' }}>通知</div>
                {([
                  { key: 'morning' as const, label: '朝6時リマインダー', sub: 'タスク登録を促す通知' },
                  { key: 'task_alert' as const, label: '期限タスク通知', sub: '開始前のアラート' },
                ] as const).map(({ key, label, sub }) => {
                  const on = prefs[key];
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#1A1A1A' }}>{label}</div>
                        <div style={{ fontSize: '11px', color: '#B4AFA9', marginTop: '1px' }}>{sub}</div>
                      </div>
                      <button disabled={pushLoading || prefsLoading} onClick={() => setPref(key, !on)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: (pushLoading || prefsLoading) ? 'wait' : 'pointer', padding: 0, flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', color: on ? '#639922' : '#B4AFA9', fontWeight: 600 }}>{on ? 'オン' : 'オフ'}</span>
                        <div style={{ width: 36, height: 20, borderRadius: 10, background: on ? '#639922' : '#D0CCC7', position: 'relative', transition: 'background .2s' }}>
                          <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CSV エクスポート */}
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f5f0eb', fontSize: '13px', color: '#1A1A1A', cursor: 'pointer', textAlign: 'left' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#8C7B6E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/>
              </svg>
              CSV エクスポート
            </button>

            {/* アカウント設定 */}
            <button onClick={() => { setMenuOpen(false); setAccountOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f5f0eb', fontSize: '13px', color: '#1A1A1A', cursor: 'pointer', textAlign: 'left' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7B6E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              </svg>
              アカウント設定
            </button>

            {/* ログアウト */}
            <button onClick={() => { setMenuOpen(false); onLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', background: 'none', border: 'none', fontSize: '13px', color: '#C0392B', cursor: 'pointer', textAlign: 'left' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/><polyline points="11,11 14,8 11,5"/><line x1="14" y1="8" x2="6" y2="8"/>
              </svg>
              ログアウト
            </button>
          </div>
        )}
      </div>
    </>
  );
}
