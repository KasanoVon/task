import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

interface Cat { id: number; name: string; sort_order: number; }

interface Props {
  value: string;
  onSelect: (v: string) => void;
  onCancel: () => void;
}

export function CategoryPicker({ value, onSelect, onCancel }: Props) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/categories`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Cat[]) => { setCats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editId !== null) editRef.current?.focus();
  }, [editId]);

  function startEdit(c: Cat) {
    setEditId(c.id);
    setEditName(c.name);
  }

  async function saveEdit(id: number) {
    const trimmed = editName.trim();
    if (!trimmed) { setEditId(null); return; }
    const oldName = cats.find(c => c.id === id)?.name ?? '';
    const res = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setCats(prev => prev.map(c => c.id === id ? { ...c, name: trimmed } : c));
      if (oldName === value) { onSelect(trimmed); return; }
    }
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await fetch(`${API_BASE}/api/categories/${id}`, { method: 'DELETE', credentials: 'include' });
    setCats(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '420px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0ebe3', flexShrink: 0 }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>カテゴリを選択</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* リスト */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '8px' }}>
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>読み込み中…</div>
          )}
          {!loading && cats.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f5f0eb', minHeight: '48px' }}>
              {editId === c.id ? (
                <>
                  <input
                    ref={editRef}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditId(null); }}
                    style={{ flex: 1, fontSize: '14px', padding: '10px 16px', border: 'none', outline: 'none', background: '#faf8f5', color: '#1A1A1A' }}
                  />
                  <button onClick={() => saveEdit(c.id)} style={{ padding: '10px 10px', background: 'none', border: 'none', color: '#7F77DD', fontWeight: 700, cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>保存</button>
                  <button onClick={() => setEditId(null)} style={{ padding: '10px 12px 10px 4px', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '15px', flexShrink: 0 }}>×</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(c.name)}
                    style={{ flex: 1, padding: '13px 20px', background: c.name === value ? '#F5E6DC' : 'none', border: 'none', fontSize: '15px', color: c.name === value ? '#8C4A2B' : '#1A1A1A', fontWeight: c.name === value ? 600 : 400, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    {c.name}
                    {c.name === value && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#D4916E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,8 6.5,12 13,4" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(c)}
                    style={{ padding: '10px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#B4AFA9', flexShrink: 0 }}
                    aria-label="編集"
                  >
                    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 2.5l1.5 1.5-6 6H3v-1.5l6-6z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={c.name === value || c.name === 'その他'}
                    style={{ padding: '10px 14px 10px 4px', background: 'none', border: 'none', cursor: c.name === value || c.name === 'その他' ? 'not-allowed' : 'pointer', color: c.name === value || c.name === 'その他' ? '#ddd' : '#E24B4A', flexShrink: 0 }}
                    aria-label="削除"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="3" y1="3" x2="10" y2="10" /><line x1="10" y1="3" x2="3" y2="10" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

