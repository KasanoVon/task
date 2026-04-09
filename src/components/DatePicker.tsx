import { useState } from 'react';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: Date) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseDate(s: string): Date {
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

const WDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  value: string; // YYYY-MM-DD
  onSelect: (v: string) => void;
  onCancel: () => void;
}

export function DatePicker({ value, onSelect, onCancel }: Props) {
  const init = parseDate(value);
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());
  const [selected, setSelected] = useState(value);

  function move(dir: number) {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  }

  function renderCells() {
    const cells = [];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = fmtDate(new Date());

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={'e' + i} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = year + '-' + pad(month + 1) + '-' + pad(d);
      const isToday = ds === today;
      const isSel = ds === selected;
      const dow = new Date(ds + 'T00:00:00').getDay();
      const isWeekend = dow === 0 || dow === 6;
      cells.push(
        <button
          key={ds}
          onClick={() => setSelected(ds)}
          style={{
            width: '36px', height: '36px', borderRadius: '50%', border: 'none',
            cursor: 'pointer', fontSize: '14px',
            background: isSel ? '#D4916E' : isToday ? '#F5E6DC' : 'none',
            color: isSel ? '#fff' : isToday ? '#8C4A2B' : isWeekend ? '#E08060' : '#1A1A1A',
            fontWeight: isSel || isToday ? 700 : 400,
          }}
        >{d}</button>
      );
    }
    return cells;
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '420px', paddingBottom: '24px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0ebe3' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>実施日を選択</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* 月ナビ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
          <button onClick={() => move(-1)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888', cursor: 'pointer', padding: '4px 8px' }}>‹</button>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>{year}年{month + 1}月</span>
          <button onClick={() => move(1)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888', cursor: 'pointer', padding: '4px 8px' }}>›</button>
        </div>

        {/* 曜日ヘッダー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', padding: '0 12px' }}>
          {WDAYS.map((w, i) => (
            <div key={i} style={{ fontSize: '11px', color: i === 0 || i === 6 ? '#E08060' : '#B4AFA9', padding: '4px 0', fontWeight: 600 }}>{w}</div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', padding: '0 12px 12px', placeItems: 'center' }}>
          {renderCells()}
        </div>

        {/* ボタン */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', padding: '0 20px' }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#999', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}>キャンセル</button>
          <button
            onClick={() => onSelect(selected)}
            style={{ background: 'none', border: 'none', color: '#D4916E', fontSize: '14px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
          >OK</button>
        </div>
      </div>
    </div>
  );
}
