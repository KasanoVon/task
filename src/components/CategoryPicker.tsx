import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const DESCS: Record<string, string> = {
  '生活・家事': '家事・日常のルーティン',
  '仕事・学習': '業務・勉強・スキルアップ',
  '健康・ケア': '運動・睡眠・医療・美容',
  '余暇・趣味': '娯楽・趣味・読書',
  '移動':       '外出・通勤・移動',
  '人間関係':   '家族・友人・交流',
};

interface Cat { id: number; name: string; }

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

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '420px', paddingBottom: '24px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0ebe3' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>カテゴリを選択</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {loading && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>読み込み中…</div>
        )}
        {!loading && cats.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.name)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px 20px',
              background: c.name === value ? '#F5E6DC' : 'none',
              border: 'none', borderBottom: '1px solid #f5f0eb',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: c.name === value ? 600 : 400, color: c.name === value ? '#8C4A2B' : '#1A1A1A' }}>
                {c.name}
              </div>
              {DESCS[c.name] && (
                <div style={{ fontSize: '12px', color: '#B4AFA9', marginTop: '2px' }}>{DESCS[c.name]}</div>
              )}
            </div>
            {c.name === value && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#D4916E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,8 6.5,12 13,4" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
