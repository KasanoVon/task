import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const GROUP_ORDER = ['生活', '仕事・学習', '健康', 'お金', '余暇', '人間関係', '移動'];

interface Cat { id: number; name: string; group_name: string | null; }

interface Props {
  value: string;
  onSelect: (v: string) => void;
  onCancel: () => void;
}

export function CategoryPicker({ value, onSelect, onCancel }: Props) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/categories`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Cat[]) => { setCats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // グループ順にまとめる。group_name が null / 未知のものは末尾に
  const groups: { label: string; items: Cat[] }[] = [];
  const placed = new Set<number>();

  for (const g of GROUP_ORDER) {
    const items = cats.filter(c => c.group_name === g);
    if (items.length > 0) {
      groups.push({ label: g, items });
      items.forEach(c => placed.add(c.id));
    }
  }
  const rest = cats.filter(c => !placed.has(c.id));
  if (rest.length > 0) groups.push({ label: 'その他', items: rest });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '420px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0ebe3', flexShrink: 0 }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>カテゴリを選択</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '8px' }}>
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>読み込み中…</div>
          )}
          {!loading && groups.map(g => (
            <div key={g.label}>
              <div style={{ padding: '10px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#B4AFA9', letterSpacing: '0.05em', background: '#faf8f5' }}>
                {g.label}
              </div>
              {g.items.map(c => (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.name)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 20px 12px 28px', background: c.name === value ? '#F5E6DC' : 'none', border: 'none', borderBottom: '1px solid #f5f0eb', fontSize: '14px', color: c.name === value ? '#8C4A2B' : '#1A1A1A', fontWeight: c.name === value ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}
                >
                  {c.name}
                  {c.name === value && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#D4916E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,8 6.5,12 13,4" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
