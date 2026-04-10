import { useState, useRef, useEffect } from 'react';

const ITEM_H = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS = Array.from({ length: 60 }, (_, i) => i);

function parseTime(s: string): [number, number] {
  const [h, m] = (s ?? '00:00').split(':').map(Number);
  return [isNaN(h) ? 0 : h, isNaN(m) ? 0 : m];
}

interface ColProps {
  items: number[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  label: string;
}

function ScrollCol({ items, selectedIdx, onSelect, label }: ColProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedIdx * ITEM_H;
  }, []);

  const handleScroll = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const i = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      ref.current.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
      onSelect(clamped);
    }, 120);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: ITEM_H, left: 0, right: 0, height: ITEM_H, borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', pointerEvents: 'none', zIndex: 1 }} />
        <div ref={ref} onScroll={handleScroll} style={{ height: ITEM_H * 3, overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}>
          <div style={{ height: ITEM_H }} />
          {items.map((item, i) => (
            <div key={i} style={{ height: ITEM_H, scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: i === selectedIdx ? 700 : 400, color: i === selectedIdx ? '#1A1A1A' : '#C0BBB5', transition: 'color 0.1s' }}>
              {String(item).padStart(2, '0')}
            </div>
          ))}
          <div style={{ height: ITEM_H }} />
        </div>
      </div>
    </div>
  );
}

interface Props {
  value: string; // HH:MM
  title?: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}

export function TimePicker({ value, title = '時刻を選択', onConfirm, onCancel }: Props) {
  const [h, m] = parseTime(value);
  const [selH, setSelH] = useState(h);
  const [selM, setSelM] = useState(m);

  const fmt = () => String(selH).padStart(2, '0') + ':' + String(selM).padStart(2, '0');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '20px 24px 16px', minWidth: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#1A1A1A' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <ScrollCol items={HOURS} selectedIdx={selH} onSelect={setSelH} label="時" />
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', marginTop: '20px' }}>:</span>
          <ScrollCol items={MINS} selectedIdx={selM} onSelect={setSelM} label="分" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginTop: '16px' }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#999', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}>キャンセル</button>
          <button onClick={() => onConfirm(fmt())} style={{ background: 'none', border: 'none', color: '#D4916E', fontSize: '14px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}>OK</button>
        </div>
      </div>
    </div>
  );
}
