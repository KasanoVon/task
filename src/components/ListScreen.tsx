import { useState, useRef } from 'react';
import { useTask } from '../context/TaskContext';
import { TaskModal } from './TaskModal';
import type { Task } from '../types';

const RUNIT_JP: Record<string, string> = { hour: '時間', day: '日', week: '週', month: 'ヶ月' };
const WDAYS_JP = ['月', '火', '水', '木', '金', '土', '日'];

function rLabel(t: Task) {
  const w = t.wdays && t.wdays.length ? '（' + t.wdays.map(d => WDAYS_JP[d]).join('') + '）' : '';
  return '毎' + (t.rnum ?? 1) + RUNIT_JP[t.runit ?? 'day'] + w + ' ' + (t.rtime ?? '');
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

type SortMode = 'manual' | 'deadline' | 'diff' | 'time' | 'cat';

function dateStr() {
  const d = new Date();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + days[d.getDay()] + '曜日';
}

interface Props {
  onShowFocus: () => void;
  username: string;
  onLogout: () => void;
}

export function ListScreen({ onShowFocus, username, onLogout }: Props) {
  const { state, updateTask, deleteTask, reorderTasks } = useTask();
  const { tasks } = state;
  const td = todayStr();
  // 今日のタスクのみ表示
  const todayTasks = tasks.filter(t => {
    if (t.type === 'timed') return t.task_date === td;
    if (t.type === 'repeat') return true;
    // 通常タスク: 完了済みは今日のみ、未完了は日付なし or 今日
    if (t.done) return t.task_date === td;
    return !t.task_date || t.task_date === td;
  });
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const dragSrc = useRef<number | null>(null);

  function getSorted() {
    const b = [...todayTasks];
    if (sortMode === 'deadline') return b.sort((a, c) => {
      const ta = a.type === 'timed' ? (a.task_date ?? '') + 'T' + (a.end_time ?? '') :
                 a.type === 'repeat' ? '9999T' + (a.rtime ?? '') : '9999T99:99';
      const tc = c.type === 'timed' ? (c.task_date ?? '') + 'T' + (c.end_time ?? '') :
                 c.type === 'repeat' ? '9999T' + (c.rtime ?? '') : '9999T99:99';
      return ta < tc ? -1 : 1;
    });
    if (sortMode === 'diff') return b.sort((a, c) => {
      const m: Record<string, number> = { easy: 0, mid: 1, hard: 2 };
      return (m[a.diff] ?? 1) - (m[c.diff] ?? 1);
    });
    if (sortMode === 'time') return b.sort((a, c) => (parseInt(a.dur) || 0) - (parseInt(c.dur) || 0));
    if (sortMode === 'cat') return b.sort((a, c) => a.cat.localeCompare(c.cat, 'ja'));
    return b;
  }

  async function handleDrop(fromId: number, toId: number) {
    if (fromId === toId) return;
    const list = [...tasks];
    const fi = list.findIndex(t => t.id === fromId);
    const ti = list.findIndex(t => t.id === toId);
    if (fi < 0 || ti < 0) return;
    const [moved] = list.splice(fi, 1);
    list.splice(ti, 0, moved);
    await reorderTasks(list.map(t => t.id));
  }

  async function toggleDone(t: Task) {
    await updateTask(t.id, { done: !t.done ? 1 : 0 } as unknown as Partial<Task>);
  }

  const sorted = getSorted();

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="topbar topbar-accent" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="tb-title-accent" style={{ fontSize: '15px', fontWeight: 600 }}>{dateStr()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>{username}</span>
          <button style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer' }} onClick={onLogout}>ログアウト</button>
        </div>
      </div>

      {formOpen && <TaskModal onClose={() => setFormOpen(false)} />}
      {editTask && <TaskModal task={editTask} onClose={() => setEditTask(null)} />}

      <div style={{ padding: '14px 14px 4px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="sort-tabs" style={{ display: 'flex', alignItems: 'center' }}>
        {(['manual', 'deadline', 'diff', 'time', 'cat'] as SortMode[]).map(m => (
          <button
            key={m}
            className={`stab${sortMode === m ? ' on' : ''}`}
            onClick={() => setSortMode(m)}
          >
            {m === 'manual' ? '手動' : m === 'deadline' ? '期限順' : m === 'diff' ? '難易度' : m === 'time' ? '時間順' : 'カテゴリ'}
          </button>
        ))}
        <button className="tb-btn btn-te" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => setFormOpen(true)}>＋ 追加</button>
      </div>

      <div className="task-list">
        {sorted.map(t => (
          <div
            key={t.id}
            className={[
              'ti',
              t.done ? 'done-i' : '',
              t.type === 'timed' ? 'timed-i' : t.type === 'repeat' ? 'repeat-i' : '',
            ].filter(Boolean).join(' ')}
            draggable={sortMode === 'manual'}
            onDragStart={() => { dragSrc.current = t.id; }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
            onDrop={async e => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              if (dragSrc.current !== null) await handleDrop(dragSrc.current, t.id);
            }}
            onDragEnd={e => { dragSrc.current = null; e.currentTarget.classList.remove('dragging', 'drag-over'); }}
          >
            <div className="dh" style={{ opacity: sortMode === 'manual' ? 1 : 0.3 }}>
              <span /><span /><span />
            </div>
            <div className={`dd dd-${t.diff[0]}`} />
            <div className="ti-body">
              <div className={`ti-name${t.done ? ' done' : ''}`}>{t.name}</div>
              <div className="ti-meta">
                <span className="tp p-tm">{t.dur}</span>
                <span className="tp p-ct">{t.cat}</span>
                {t.type === 'timed' && <span className="tp p-dl2">期限 {t.end_time}</span>}
                {t.type === 'repeat' && <span className="tp p-rp2">{rLabel(t)}</span>}
                {t.done && <span className="tp p-dn">完了</span>}
              </div>
            </div>
            <div className="ti-acts">
              <button className="ab edt" onClick={() => setEditTask(t)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2.5l1.5 1.5-6 6H3v-1.5l6-6z" />
                </svg>
              </button>
              <button
                className={`ab ck${t.done ? ' on' : ''}`}
                onClick={() => toggleDone(t)}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={t.done ? '#639922' : '#B4B2A9'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2,6.5 5,10 11,3" />
                </svg>
              </button>
              <button className="ab del" onClick={() => deleteTask(t.id)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2="10" y2="10" /><line x1="10" y1="3" x2="3" y2="10" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
        <button className="start-btn" onClick={onShowFocus}>この順番でスタート →</button>
      </div>
      </div>
    </div>
  );
}
