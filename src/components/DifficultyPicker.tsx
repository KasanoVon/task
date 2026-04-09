const OPTIONS = [
  { value: 'easy', label: '簡単', desc: 'すぐ終わる・慣れた作業' },
  { value: 'mid',  label: '普通', desc: 'ある程度の集中が必要' },
  { value: 'hard', label: '難しい', desc: '集中力・時間が多く必要' },
] as const;

type Diff = 'easy' | 'mid' | 'hard';

interface Props {
  value: Diff;
  onSelect: (v: Diff) => void;
  onCancel: () => void;
}

export function DifficultyPicker({ value, onSelect, onCancel }: Props) {
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
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>難易度を選択</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px 20px',
              background: opt.value === value ? '#F5E6DC' : 'none',
              border: 'none', borderBottom: '1px solid #f5f0eb',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: opt.value === value ? 600 : 400, color: opt.value === value ? '#8C4A2B' : '#1A1A1A' }}>{opt.label}</div>
              <div style={{ fontSize: '12px', color: '#B4AFA9', marginTop: '2px' }}>{opt.desc}</div>
            </div>
            {opt.value === value && (
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
