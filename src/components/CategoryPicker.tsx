interface Group {
  label: string;
  items: string[];
}

const GROUPS: Group[] = [
  { label: '生活', items: ['掃除', '片付け', '料理'] },
  { label: '仕事', items: ['業務・タスク'] },
  { label: '成長', items: ['勉強', '資格'] },
  { label: '健康', items: ['運動', '体調管理'] },
  { label: '趣味', items: ['遊び', '娯楽'] },
  { label: 'お金', items: ['支出', '投資'] },
  { label: 'その他', items: ['その他'] },
];

interface Props {
  value: string;
  onSelect: (v: string) => void;
  onCancel: () => void;
}

export function CategoryPicker({ value, onSelect, onCancel }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '420px',
          maxHeight: '70vh', overflowY: 'auto', paddingBottom: '24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0ebe3', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>カテゴリを選択</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {GROUPS.map(g => (
          <div key={g.label}>
            <div style={{ padding: '10px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#B4AFA9', letterSpacing: '0.05em' }}>
              {g.label}
            </div>
            {g.items.map(item => (
              <button
                key={item}
                onClick={() => onSelect(item)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '13px 20px',
                  background: item === value ? '#F5E6DC' : 'none',
                  border: 'none', borderBottom: '1px solid #f5f0eb',
                  fontSize: '15px', color: item === value ? '#8C4A2B' : '#1A1A1A',
                  fontWeight: item === value ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {item}
                {item === value && (
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
  );
}
