import { useState, useEffect } from 'react';
import { useTask } from '../context/TaskContext';
import type { StreakRow } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function pad(n: number) { return String(n).padStart(2, '0'); }
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function durToMin(s: string) { return parseInt(s) || 0; }

interface Props {
  onShowFocus: () => void;
  onShowList: () => void;
  onShowCal: () => void;
}

export function DoneScreen({ onShowFocus, onShowList, onShowCal }: Props) {
  const { state } = useTask();
  const { completedLog } = state;
  const [streak, setStreak] = useState(0);
  const [streakRows, setStreakRows] = useState<StreakRow[]>([]);

  const totalMin = completedLog.reduce((s, t) => s + durToMin(t.dur), 0);

  useEffect(() => {
    async function fetchStreaks() {
      try {
        const res = await fetch(`${API_BASE}/api/streaks?days=14`, { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { streak: number; rows: StreakRow[] };
        setStreak(data.streak);
        setStreakRows(data.rows);
      } catch { /* 無視 */ }
    }
    fetchStreaks();
  }, []);

  function renderDots() {
    const days = ['月', '火', '水', '木', '金', '土', '日', '月', '火', '水', '木', '金', '土', '日'];
    const td = today();
    const dots = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const hit = streakRows.find(r => r.streak_date === ds);
      const isToday = ds === td;
      const cls = isToday ? 'dot d-today' : hit && hit.completed > 0 ? 'dot d-done' : 'dot d-miss';
      const lbl = isToday ? '今' : days[d.getDay() === 0 ? 6 : d.getDay() - 1];
      dots.push(<div key={ds} className={cls}>{lbl}</div>);
    }
    return dots;
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="topbar">
        <span className="tb-title" style={{ fontSize: '22px', fontWeight: 700 }}>完了</span>
      </div>

      <div className="done-screen">
        <div className="done-title">きょうもおつかれさま！</div>
        <div className="done-sub">まとめ</div>

        <div className="sum-grid">
          <div className="sum-card">
            <div className="sum-val">{completedLog.length}</div>
            <div className="sum-lbl">タスク完了</div>
          </div>
          <div className="sum-card">
            <div className="sum-val">{totalMin}</div>
            <div className="sum-lbl">合計（分）</div>
          </div>
          <div className="sum-card">
            <div className="sum-val">{streak}</div>
            <div className="sum-lbl">れんぞく日</div>
          </div>
        </div>

        <div className="streak-section">
          <div className="sr-head">
            <span className="sr-title">れんぞくきろく</span>
            <span className="sr-num">🔥 {streak}日れんぞく</span>
          </div>
          <div className="dots">{renderDots()}</div>
        </div>

        <div className="log-wrap">
          <div className="log-lbl">きょうのきろく</div>
          {completedLog.map((t, i) => {
            const bg = t.type === 'timed' ? 'li-timed-bg' : 'li-done-bg';
            const stroke = t.type === 'timed' ? '#D85A30' : '#639922';
            const typetag = t.type === 'timed'
              ? <span style={{ fontSize: '10px', background: '#FAECE7', color: '#712B13', padding: '1px 6px', borderRadius: '999px' }}>期限あり</span>
              : t.type === 'repeat'
              ? <span style={{ fontSize: '10px', background: '#EEEDFE', color: '#534AB7', padding: '1px 6px', borderRadius: '999px' }}>定期</span>
              : null;
            return (
              <div key={i} className="log-item">
                <div className={`li-ic ${bg}`}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,6.5 5,10 11,3" />
                  </svg>
                </div>
                <div className="li-body">
                  <div className="li-name">{t.name}</div>
                  <div className="li-meta">{t.dur} {typetag}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gr-d)' }}>完了</div>
              </div>
            );
          })}
        </div>

        <div className="done-acts" style={{ marginTop: 'auto' }}>
          <button className="da-btn da-p" onClick={onShowFocus}>フォーカスに戻る</button>
          <button className="da-btn da-s" onClick={onShowList}>タスク一覧を見る</button>
          <button className="da-btn da-s" onClick={onShowCal}>カレンダーを見る</button>
        </div>
      </div>
    </div>
  );
}
