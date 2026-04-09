import { useState, useRef, useEffect } from 'react';

const ITEM_H = 44;
const HOURS = Array.from({ length: 9 }, (_, i) => i); // 0〜8時間
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parseDur(s: string): [number, number] {
  const hMatch = s.match(/(\d+)時間/);
  const mMatch = s.match(/(\d+)分/);
  const h = hMatch ? parseInt(hMatch[1]) : 0;
  const m = mMatch ? parseInt(mMatch[1]) : 0;
  if (!hMatch && !mMatch) {
    const n = parseInt(s);
    return [0, isNaN(n) ? 10 : n];
  }
  return [h, m];
}

export function fmtDur(h: number, m: number): string {
  if (h === 0 && m === 0) return '5分';
  if (h === 0) return m + '分';
  if (m === 0) return h + '時間';
  return h + '時間' + m + '分';
}

interface ColProps {
  items: number[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  label: string;
  fmt?: (n: number) => string;
}

function ScrollCol({ items, selectedIdx, onSelect, label, fmt }: ColProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = selectedIdx * ITEM_H;
    }
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
        {/* 選択中ハイライト */}
        <div style={{
          position: 'absolute', top: ITEM_H, left: 0, right: 0, height: ITEM_H,
          borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd',
          pointerEvents: 'none', zIndex: 1,
        }} />
        <div
          ref={ref}
          onScroll={handleScroll}
          style={{
            height: ITEM_H * 3,
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch' as never,
          }}
        >
          <div style={{ height: ITEM_H, flexShrink: 0 }} />
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                height: ITEM_H,
                scrollSnapAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: i === selectedIdx ? 700 : 400,
                color: i === selectedIdx ? '#1A1A1A' : '#C0BBB5',
                transition: 'color 0.1s, font-weight 0.1s',
              }}
            >
              {fmt ? fmt(item) : String(item).padStart(2, '0')}
            </div>
          ))}
          <div style={{ height: ITEM_H, flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}

interface Props {
  value: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}

export function DurationPicker({ value, onConfirm, onCancel }: Props) {
  const [h, m] = parseDur(value);
  const initH = Math.max(0, Math.min(HOURS.length - 1, h));
  const initM = Math.max(0, MINS.indexOf(MINS.find(v => v >= m) ?? 0));

  const [selH, setSelH] = useState(initH);
  const [selM, setSelM] = useState(initM < 0 ? 0 : initM);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: '16px', padding: '20px 24px 16px',
          minWidth: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#1A1A1A' }}>
          時間を選択
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <ScrollCol items={HOURS} selectedIdx={selH} onSelect={setSelH} label="時間" fmt={n => String(n)} />
          <span style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', marginTop: '20px', userSelect: 'none' }}>:</span>
          <ScrollCol items={MINS} selectedIdx={selM} onSelect={setSelM} label="分" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', marginTop: '16px' }}>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: '#999', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}
          >キャンセル</button>
          <button
            onClick={() => onConfirm(fmtDur(HOURS[selH], MINS[selM]))}
            style={{ background: 'none', border: 'none', color: '#D4916E', fontSize: '14px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
          >OK</button>
        </div>
      </div>
    </div>
  );
}
