import { useState, useEffect } from 'react';
import type { StreakRow } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function pad(n: number) { return String(n).padStart(2, '0'); }
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function durToMin(s: string): number {
  if (!s) return 0;
  const hm = s.match(/(\d+)時間(?:(\d+)分)?/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = s.match(/(\d+)分/);
  if (m) return Number(m[1]);
  return parseInt(s) || 0;
}

function formatTime(min: number) {
  if (min === 0) return '0分';
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function achievementMsg(count: number, min: number) {
  if (count === 0) return 'お疲れさまでした！';
  if (min >= 120) return `${formatTime(min)}、よく頑張りました！`;
  if (count >= 5) return `${count}個のタスク完了！お疲れさまでした`;
  return '今日もお疲れさまでした！';
}

function streakMsg(streak: number) {
  if (streak === 0) return '今日からスタート！明日も続けよう';
  if (streak === 1) return '連続1日目！明日も続けよう';
  if (streak >= 7) return `🏆 ${streak}日連続！すごい！`;
  if (streak >= 3) return `🔥 ${streak}日連続！`;
  return `${streak}日連続中！`;
}

const TYPE_JP: Record<string, string> = {
  normal: '通常',
  timed: '期限あり',
  repeat: '定期',
  stock: 'ストック',
};

interface LogRow {
  id: number;
  task_name: string;
  task_type: string;
  dur: string;
  done: number;
}

interface Props {
  onShowFocus: () => void;
  onShowList: () => void;
  onShowCal: () => void;
}

export function DoneScreen({ onShowFocus, onShowList, onShowCal }: Props) {
  const [streak, setStreak] = useState(0);
  const [streakRows, setStreakRows] = useState<StreakRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const totalMin = logs.reduce((s, t) => s + durToMin(t.dur), 0);

  const byType = logs.reduce<Record<string, { count: number; min: number }>>((acc, l) => {
    const k = l.task_type;
    if (!acc[k]) acc[k] = { count: 0, min: 0 };
    acc[k].count++;
    acc[k].min += durToMin(l.dur);
    return acc;
  }, {});

  useEffect(() => {
    async function fetchAll() {
      try {
        const [streakRes, logsRes] = await Promise.all([
          fetch(`${API_BASE}/api/streaks?days=14`, { credentials: 'include' }),
          fetch(`${API_BASE}/api/logs?date=${today()}`, { credentials: 'include' }),
        ]);
        if (streakRes.ok) {
          const data = (await streakRes.json()) as { streak: number; rows: StreakRow[] };
          setStreak(data.streak);
          setStreakRows(data.rows);
        }
        if (logsRes.ok) {
          const data = (await logsRes.json()) as LogRow[];
          setLogs(data);
        }
      } catch { /* 無視 */ }
    }
    fetchAll();
  }, []);

  function renderDots() {
    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
    const td = today();
    const dots = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const hit = streakRows.find(r => r.streak_date === ds);
      const isToday = ds === td;
      const cls = isToday ? 'dot d-today' : hit && hit.completed > 0 ? 'dot d-done' : 'dot d-miss';
      const wd = WEEKDAYS[d.getDay()];
      dots.push(
        <div key={ds} className={cls}>
          <span className="dot-wd">{isToday ? '' : wd}</span>
          <span className="dot-d">{isToday ? '今' : d.getDate()}</span>
        </div>
      );
    }
    return dots;
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="topbar">
        <span className="tb-title" style={{ fontSize: '22px', fontWeight: 700 }}>完了</span>
      </div>

      <div className="done-screen">
        <div className="done-title">
          {logs.length === 0 ? 'お疲れさまでした！' : achievementMsg(logs.length, totalMin)}
        </div>
        <div className="done-sub">
          {logs.length > 0
            ? `今日は${logs.length}個のタスクを完了しました`
            : '今日の記録はまだありません'}
        </div>

        <div className="sum-grid">
          <div className="sum-card sum-card-or">
            <div className="sum-icon">✅</div>
            <div className="sum-val">{logs.length}</div>
            <div className="sum-lbl">タスク完了</div>
          </div>
          <div className="sum-card sum-card-gr">
            <div className="sum-icon">⏱</div>
            <div className="sum-val">{formatTime(totalMin)}</div>
            <div className="sum-lbl">合計時間</div>
          </div>
          <div className="sum-card sum-card-am">
            <div className="sum-icon">🔥</div>
            <div className="sum-val">{streak}</div>
            <div className="sum-lbl">連続日</div>
          </div>
        </div>

        {Object.keys(byType).length > 0 && (
          <div className="type-breakdown">
            {Object.entries(byType).map(([type, { count, min }]) => (
              <div key={type} className="tb-pill">
                <span className="tb-pill-label">{TYPE_JP[type] ?? type}</span>
                <span className="tb-pill-val">{count}件{min > 0 ? ` · ${formatTime(min)}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        <div className="streak-section">
          <div className="sr-head">
            <span className="sr-title">連続記録</span>
            <span className="sr-num">{streakMsg(streak)}</span>
          </div>
          <div className="dots">{renderDots()}</div>
        </div>

        <div className="log-wrap">
          <div className="log-lbl">今日の記録</div>
          {logs.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>
              まだ完了したタスクはありません
            </div>
          )}
          {logs.map((t, i) => {
            const bg = t.task_type === 'timed' ? 'li-timed-bg' : 'li-done-bg';
            const stroke = t.task_type === 'timed' ? '#D85A30' : '#639922';
            const typetag = t.task_type === 'timed'
              ? <span style={{ fontSize: '10px', background: '#FAECE7', color: '#712B13', padding: '1px 6px', borderRadius: '999px' }}>期限あり</span>
              : t.task_type === 'repeat'
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
                  <div className="li-name">{t.task_name}</div>
                  <div className="li-meta">{t.dur} {typetag}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gr-d)' }}>完了</div>
              </div>
            );
          })}
        </div>

        <div className="done-acts" style={{ marginTop: 'auto' }}>
          <button className="da-btn da-x" onClick={() => {
            const text = logs.length > 0
              ? `今日は${logs.length}個のタスクを完了！${streak >= 3 ? `🔥${streak}日連続中` : streak > 0 ? `${streak}日連続中` : '今日からスタート'} #TaskVon`
              : `今日もタスク管理がんばります💪 #TaskVon`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://taskvon.up.railway.app')}`, '_blank');
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: '6px' }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.738-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Xでシェア
          </button>
          <button className="da-btn da-p" onClick={onShowFocus}>フォーカスに戻る</button>
          <button className="da-btn da-s" onClick={onShowList}>タスク一覧を見る</button>
          <button className="da-btn da-s" onClick={onShowCal}>カレンダーを見る</button>
        </div>
      </div>
    </div>
  );
}
