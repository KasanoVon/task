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

type SortMode = 'manual' | 'deadline' | 'diff' | 'time' | 'cat';

interface Props {
  onShowFocus: () => void;
}

export function ListScreen({ onShowFocus }: Props) {
  const { state, updateTask, deleteTask, reorderTasks } = useTask();
  const { tasks } = state;
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [formOpen, setFormOpen] = useState(false);
  const dragSrc = useRef<number | null>(null);

  function getSorted() {
    const b = [...tasks];
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

  async function toggleDone(t: Task) {
    await updateTask(t.id, { done: !t.done ? 1 : 0 } as unknown as Partial<Task>);
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

  const sorted = getSorted();

  return (
    <div>
      <div className="topbar">
        <button className="tb-btn btn-pu" onClick={onShowFocus}>‹ フォーカスへ</button>
        <span className="tb-title">タスク一覧</span>
        <button className="tb-btn btn-te" onClick={() => setFormOpen(true)}>＋ ついか</button>
      </div>

      {formOpen && <TaskModal onClose={() => setFormOpen(false)} />}

      <div className="sort-tabs">
        {(['manual', 'deadline', 'diff', 'time', 'cat'] as SortMode[]).map(m => (
          <button
            key={m}
            className={`stab${sortMode === m ? ' on' : ''}`}
            onClick={() => setSortMode(m)}
          >
            {m === 'manual' ? '手動' : m === 'deadline' ? '期限順' : m === 'diff' ? '難易度' : m === 'time' ? '時間順' : 'カテゴリ'}
          </button>
        ))}
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

      <button className="start-btn" onClick={onShowFocus}>このじゅんばんでスタート ›</button>
    </div>
  );
}
