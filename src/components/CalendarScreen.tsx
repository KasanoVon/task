import { useState } from 'react';
import { useTask } from '../context/TaskContext';
import { TaskModal } from './TaskModal';
import type { Task } from '../types';

function pad(n: number) { return String(n).padStart(2, '0'); }
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function fmtDate(d: Date) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function isRepeatOnDate(t: Task, ds: string) {
  const d = new Date(ds + 'T00:00:00');
  if (t.runit === 'day' || t.runit === 'hour') return true;
  if (t.runit === 'week') {
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    if (!t.wdays || !t.wdays.length) return true;
    return t.wdays.includes(dow);
  }
  if (t.runit === 'month') {
    if (!t.created_at) return false;
    return d.getDate() === new Date(t.created_at).getDate();
  }
  return false;
}

function taskOnDate(t: Task, ds: string) {
  if (t.type === 'stock') return false;
  if (t.type === 'timed') return t.task_date === ds;
  if (t.type === 'repeat') return isRepeatOnDate(t, ds);
  // 通常タスク: 日付ありはその日
  if (t.task_date) return t.task_date === ds;
  // 日付なし・未完了: 今日のみ
  if (!t.done) return ds === today();
  // 日付なし・完了: 日付不明の古いデータなので表示しない
  return false;
}

interface Props {
  onShowFocus: () => void;
  onShowList: () => void;
  username: string;
  onLogout: () => void;
}

function dateStr() {
  const d = new Date();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + days[d.getDay()] + '曜日';
}

type CalView = 'month' | 'week';

export function CalendarScreen({ onShowFocus: _onShowFocus, onShowList: _onShowList, username, onLogout }: Props) {
  const { state } = useTask();
  const { tasks } = state;

  const [calView] = useState<CalView>('month');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calWeekStart, setCalWeekStart] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const td = today();

  function getWeekStart(): Date {
    if (calWeekStart) return calWeekStart;
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function calMove(dir: number) {
    if (calView === 'month') {
      let m = calMonth + dir;
      let y = calYear;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      setCalMonth(m);
      setCalYear(y);
    } else {
      const ws = getWeekStart();
      const d = new Date(ws);
      d.setDate(d.getDate() + dir * 7);
      setCalWeekStart(d);
    }
    setSelectedDate(null);
  }

  function navTitle() {
    if (calView === 'month') return calYear + '年' + (calMonth + 1) + '月';
    const ws = getWeekStart();
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    return ws.getMonth() === we.getMonth()
      ? (ws.getMonth() + 1) + '月' + ws.getDate() + '日〜' + we.getDate() + '日'
      : (ws.getMonth() + 1) + '月' + ws.getDate() + '日〜' + (we.getMonth() + 1) + '月' + we.getDate() + '日';
  }

  // 月表示セル
  function renderMonthCells() {
    const cells = [];
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevDays = new Date(calYear, calMonth, 0).getDate();

    // 前月
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevDays - i;
      const ds = fmtDate(new Date(calYear, calMonth - 1, day));
      cells.push(makeCell(ds, day, true));
    }
    // 今月
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = fmtDate(new Date(calYear, calMonth, d));
      cells.push(makeCell(ds, d, false));
    }
    // 翌月
    const total = firstDay + daysInMonth;
    const remain = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= remain; d++) {
      const ds = fmtDate(new Date(calYear, calMonth + 1, d));
      cells.push(makeCell(ds, d, true));
    }
    return cells;
  }

  function makeCell(ds: string, dayNum: number, otherMonth: boolean) {
    const dow = new Date(ds + 'T00:00:00').getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isToday = ds === td;
    const isSelected = selectedDate === ds;
    const dayTasks = tasks.filter(t => taskOnDate(t, ds));
    const shown = dayTasks.slice(0, 5);

    return (
      <div
        key={ds}
        className={[
          'cal-cell',
          otherMonth ? 'other-month' : '',
          isToday ? 'today' : '',
          isWeekend ? 'weekend-cell' : '',
          isSelected ? 'selected' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => setSelectedDate(ds)}
      >
        <div className="cal-day-num">{dayNum}</div>
        <div className="cal-dot-row">
          {shown.map((t, i) => (
            <div key={i} className={`cal-dot ${t.done ? 'cal-dot-d' : t.type === 'timed' ? 'cal-dot-t' : t.type === 'repeat' ? 'cal-dot-r' : 'cal-dot-n'}`} />
          ))}
        </div>
        {dayTasks.length > 5 && <div className="cal-more">+{dayTasks.length - 5}</div>}
      </div>
    );
  }

  // 週表示
  function renderWeekColumns() {
    const ws = getWeekStart();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const headers = [<div key="hd-time" className="week-hd-time" />];
    const cols = [
      <div key="time-col" className="week-time-col">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="week-time-slot">{pad(h)}:00</div>
        ))}
      </div>,
    ];

    for (let i = 0; i < 7; i++) {
      const d = new Date(ws); d.setDate(d.getDate() + i);
      const ds = fmtDate(d);
      const dow = d.getDay();
      const isToday = ds === td;
      const isWeekend = dow === 0 || dow === 6;

      // ヘッダー
      headers.push(
        <div
          key={`hd-${i}`}
          className={['week-hd-day', isToday ? 'today-col' : '', isWeekend ? 'weekend-col' : ''].filter(Boolean).join(' ')}
          onClick={() => setSelectedDate(ds)}
        >
          <span className={`week-hd-num${isToday ? ' today-num' : ''}`}>{d.getDate()}</span>
          {dayNames[dow]}
        </div>
      );

      // 列
      const timedTasks = tasks.filter(t => t.type === 'timed' && t.task_date === ds);
      const repeatTasks = tasks.filter(t => t.type === 'repeat' && isRepeatOnDate(t, ds));

      cols.push(
        <div key={`col-${i}`} className="week-day-col">
          {Array.from({ length: 24 }, (_, h) => <div key={h} className="week-slot" />)}
          {timedTasks.map(t => {
            const [sh, sm] = (t.start_time ?? '09:00').split(':').map(Number);
            const [eh, em] = (t.end_time ?? '10:00').split(':').map(Number);
            const top = (sh * 60 + sm) / 60 * 40;
            const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 40, 20);
            return (
              <div
                key={t.id}
                className={`week-event we-timed${t.done ? ' we-done' : ''}`}
                style={{ top: top + 'px', height: height + 'px' }}
                onClick={e => { e.stopPropagation(); setSelectedDate(ds); }}
              >
                {t.name}
              </div>
            );
          })}
          {repeatTasks.map((t, idx) => {
            const [rh, rm] = (t.rtime ?? '08:00').split(':').map(Number);
            const top = (rh * 60 + rm) / 60 * 40;
            return (
              <div
                key={t.id}
                className={`week-event we-repeat${t.done ? ' we-done' : ''}`}
                style={{ top: top + 'px', height: '20px', left: (2 + idx * 2) + 'px' }}
                onClick={e => { e.stopPropagation(); setSelectedDate(ds); }}
              >
                {t.name}
              </div>
            );
          })}
        </div>
      );
    }

    return { headers, cols };
  }

  const { headers, cols } = renderWeekColumns();

  // 日別詳細パネル
  function renderDayPanel() {
    if (!selectedDate) return null;
    const d = new Date(selectedDate + 'T00:00:00');
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayTasks = tasks.filter(t => taskOnDate(t, selectedDate));

    return (
      <div className="day-panel">
        <div className="dp-head">
          <span className="dp-title">
            {(d.getMonth() + 1)}月{d.getDate()}日（{dayNames[d.getDay()]}）
          </span>
          <button className="dp-close" onClick={() => setSelectedDate(null)}>×</button>
        </div>
        <div>
          {dayTasks.length === 0 ? (
            <div className="dp-empty">この日のタスクはありません</div>
          ) : dayTasks.map(t => {
            const colorCls = t.done ? 'dp-c-n' : t.type === 'timed' ? 'dp-c-t' : t.type === 'repeat' ? 'dp-c-r' : 'dp-c-n';
            const timeStr = t.type === 'timed' ? (t.start_time ?? '') + '〜' + (t.end_time ?? '') :
                            t.type === 'repeat' ? (t.rtime ?? '') : '';
            const statusCls = t.done ? 'dp-s-done' : t.type === 'timed' && selectedDate < today() ? 'dp-s-dead' : 'dp-s-pend';
            const statusTxt = t.done ? '完了' : t.type === 'timed' && selectedDate < today() ? '期限切れ' : '未完了';
            return (
              <div key={t.id} className={`dp-item${t.done ? ' dp-done' : ''}`}>
                <div className={`dp-color ${colorCls}`} />
                <div className="dp-info">
                  <div className="dp-name">{t.name}</div>
                  <div className="dp-meta">{t.dur}{timeStr ? ' · ' + timeStr : ''} · {t.cat}</div>
                </div>
                <span className={`dp-status ${statusCls}`}>{statusTxt}</span>
                <button
                  className="ab edt"
                  onClick={e => { e.stopPropagation(); setEditTask(t); }}
                  aria-label="編集"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 2.5l1.5 1.5-6 6H3v-1.5l6-6z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="topbar topbar-accent" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="tb-title-accent" style={{ fontSize: '15px', fontWeight: 600 }}>{dateStr()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>{username}</span>
          <button style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer' }} onClick={onLogout}>ログアウト</button>
        </div>
      </div>

      <div style={{ padding: '14px 14px 4px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {editTask && <TaskModal task={editTask} onClose={() => setEditTask(null)} />}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => calMove(-1)}>‹</button>
        <span className="cal-nav-title">{navTitle()}</span>
        <button className="cal-nav-btn" onClick={() => calMove(1)}>›</button>
      </div>

      {calView === 'month' && (
        <div id="cal-month-wrap">
          <div className="cal-grid-wrap">
            <div className="cal-weekdays">
              {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                <div key={i} className={`cal-wd${i === 0 || i === 6 ? ' weekend' : ''}`}>{w}</div>
              ))}
            </div>
            <div className="cal-cells">{renderMonthCells()}</div>
          </div>
        </div>
      )}

      {calView === 'week' && (
        <div className="week-grid">
          <div className="week-header">{headers}</div>
          <div className="week-body">{cols}</div>
        </div>
      )}

      {renderDayPanel()}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--t2)', padding: '0 2px 4px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--pu)', display: 'inline-block' }} />通常
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--co)', display: 'inline-block' }} />期限あり
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--te)', display: 'inline-block' }} />定期
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gr)', display: 'inline-block' }} />完了
        </span>
      </div>
      </div>
    </div>
  );
}
