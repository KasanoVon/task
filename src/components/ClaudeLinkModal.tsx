import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

interface KeyInfo {
  exists: boolean;
  prefix?: string;
  created_at?: string;
  last_used_at?: string | null;
}

function fmt(dt?: string | null) {
  if (!dt) return '未使用';
  const d = new Date(dt.replace(' ', 'T') + 'Z');
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      style={{ flexShrink: 0, fontSize: '11px', padding: '4px 10px', borderRadius: '999px', border: '1px solid #D4916E', background: copied ? '#D4916E' : '#fff', color: copied ? '#fff' : '#D4916E', cursor: 'pointer', fontWeight: 600 }}>
      {copied ? 'コピー済' : 'コピー'}
    </button>
  );
}

export function ClaudeLinkModal({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`${API_BASE}/api/external/key`, { credentials: 'include' });
    if (r.ok) setInfo(await r.json());
  }

  useEffect(() => { load().catch(() => {}); }, []);

  async function issue() {
    if (busy) return;
    if (info?.exists && !confirm('再発行すると今のキーは使えなくなります。よろしいですか？')) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/external/key`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error();
      const { key } = await r.json();
      setNewKey(key);
      await load();
    } catch { alert('発行に失敗しました'); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (busy || !confirm('キーを無効化しますか？Claude からの通知が止まります。')) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/external/key`, { method: 'DELETE', credentials: 'include' });
      setNewKey(null);
      await load();
    } finally { setBusy(false); }
  }

  const endpoint = `${window.location.origin}/api/external/today`;
  const prompt = `毎朝7時に ${endpoint} から今日のタスクを取得して、時刻順に短くまとめて通知して`;

  const btn = (color: string) => ({ fontSize: '12px', padding: '6px 14px', borderRadius: '999px', border: `1px solid ${color}`, background: '#fff', color, cursor: busy ? 'wait' : 'pointer', fontWeight: 600 });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', padding: '20px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A' }}>Claude 連携</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <p style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.7, margin: '0 0 12px' }}>
          Claude のスケジュールタスクが、決まった時刻に今日のタスクを読み取って通知します。API キーは読み取り専用で、タスクの追加や変更はできません。
        </p>

        <div style={{ background: '#faf8f5', borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A', marginBottom: '8px' }}>API キー</div>

          {newKey && (
            <>
              <div style={{ background: '#fff', border: '1.5px solid #D4916E', borderRadius: '10px', padding: '10px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ fontSize: '12px', fontFamily: 'monospace', color: '#8C4A2B', flex: 1, wordBreak: 'break-all' }}>{newKey}</code>
                <CopyBtn text={newKey} />
              </div>
              <p style={{ fontSize: '11px', color: '#C0392B', margin: '0 0 10px' }}>この画面を閉じると再表示できません。今すぐコピーしてください。</p>
            </>
          )}

          {info === null ? (
            <div style={{ fontSize: '12px', color: '#B4AFA9' }}>読み込み中…</div>
          ) : info.exists ? (
            <>
              {!newKey && (
                <div style={{ fontSize: '12px', color: '#6B6560', marginBottom: '10px', lineHeight: 1.7 }}>
                  <code style={{ fontFamily: 'monospace' }}>{info.prefix}…</code><br />
                  最終利用: {fmt(info.last_used_at)}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={issue} disabled={busy} style={btn('#D4916E')}>再発行</button>
                <button onClick={revoke} disabled={busy} style={btn('#C0392B')}>無効化</button>
              </div>
            </>
          ) : (
            <button onClick={issue} disabled={busy} style={btn('#D4916E')}>API キーを発行</button>
          )}
        </div>

        <div style={{ background: '#faf8f5', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A', marginBottom: '6px' }}>使い方</div>
          <ol style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.7, margin: '0 0 10px', paddingLeft: '18px' }}>
            <li>上でキーを発行してコピー</li>
            <li>Claude に下の文を送る（キーは Claude の入力フォームで登録します）</li>
          </ol>
          <div style={{ background: '#fff', border: '1px solid #E5DED6', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#1A1A1A', flex: 1, lineHeight: 1.6, wordBreak: 'break-all' }}>{prompt}</span>
            <CopyBtn text={prompt} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '999px', border: '1px solid #D0CCC7', background: '#fff', fontSize: '13px', color: '#6B6560', cursor: 'pointer', fontWeight: 500 }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
