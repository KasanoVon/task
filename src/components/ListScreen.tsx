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
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function nowHHMM() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
// 日またぎタスク（end_time < start_time）かつ昨日開始で今日まだ終わっていないか
function isCrossMidnightActive(t: Task): boolean {
  if (t.type !== 'timed' || t.done) return false;
  if ((t.end_time ?? '23:59') >= (t.start_time ?? '00:00')) return false;
  return t.task_date === yesterdayStr() && nowHHMM() <= (t.end_time ?? '00:00');
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
  // 今日のタスクのみ表示（ストックは除外）
  const todayTasks = tasks.filter(t => {
    if (t.type === 'stock') return false;
    // 期限ありは今日 + 未完了の期限切れ（翌日以降も表示）
    if (t.type === 'timed') return t.task_date === td || (!t.done && (t.task_date ?? '') < td);
    if (t.type === 'repeat') {
      if (t.done) return true;
      // 完了済み兄弟がある場合は非表示（完了直後の新インスタンスを隠す）
      if (tasks.some(o => o.id !== t.id && o.type === 'repeat' && o.done && o.name === t.name && o.rtime === t.rtime)) return false;
      // 未完了の重複がある場合は最小IDのみ表示（完了取り消し後の重複防止）
      return !tasks.some(o => o.id < t.id && o.type === 'repeat' && !o.done && o.name === t.name && o.rtime === t.rtime);
    }
    // 通常タスク: 完了済みは今日のみ、未完了は日付なし or 今日
    if (t.done) return t.task_date === td;
    return !t.task_date || t.task_date === td;
  });
  // ストックタスク
  const stockTasks = tasks.filter(t => t.type === 'stock');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const dragSrc = useRef<number | null>(null);

  // スワイプ管理
  const SWIPE_THRESHOLD = 130; // 最後まで（MAX の約80%）で発火
  const MAX_SWIPE = 160;
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipingId, setSwipingId] = useState<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const isHorizontal = useRef(false);
  // スナップ完了アニメーション中のアイテム
  const [completingSwipe, setCompletingSwipe] = useState<{ id: number; dir: 'left' | 'right' } | null>(null);

  function onTouchStart(e: React.TouchEvent, id: number) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipingId(id);
    setSwipeX(0);
    isHorizontal.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (swipingId === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isHorizontal.current) {
      if (Math.abs(dx) < Math.abs(dy)) { setSwipingId(null); return; }
      isHorizontal.current = true;
    }
    setSwipeX(Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx)));
  }

  async function onTouchEnd(t: Task) {
    if (swipingId !== t.id) { return; }
    const x = swipeX;
    // まずスワイプ中状態を解除（CSSトランジション有効化）
    setSwipingId(null);
    setSwipeX(0);

    if (x > SWIPE_THRESHOLD) {
      // 端まで広げてからモーダル表示
      setCompletingSwipe({ id: t.id, dir: 'right' });
      await new Promise<void>(r => setTimeout(r, 220));
      setCompletingSwipe(null);
      setEditTask(t);
    } else if (x < -SWIPE_THRESHOLD) {
      // 端まで広げてから完了処理
      setCompletingSwipe({ id: t.id, dir: 'left' });
      await new Promise<void>(r => setTimeout(r, 220));
      setCompletingSwipe(null);
      await toggleDone(t);
    }
  }

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
    // 通常タスクで日付未設定の場合、クライアント側の今日の日付を渡す（サーバーのタイムゾーン差異を回避）
    const extra = (!t.done && t.type === 'normal' && !t.task_date) ? { task_date: td } : {};
    await updateTask(t.id, { done: !t.done ? 1 : 0, ...extra } as unknown as Partial<Task>);
  }

  async function promoteToToday(t: Task) {
    await updateTask(t.id, { type: 'normal', task_date: td } as unknown as Partial<Task>);
  }

  const sorted = getSorted();
  const undone = sorted.filter(t => !t.done);
  const done   = sorted.filter(t => t.done);

  function renderTaskItem(t: Task) {
    return (
      <div key={t.id} style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', marginBottom: '6px' }}>
        {/* 右スワイプ背景（編集） */}
        <div style={{
          position: 'absolute', inset: 0, background: 'var(--pu)',
          display: 'flex', alignItems: 'center', paddingLeft: '20px',
          opacity: swipingId === t.id && swipeX > 0
            ? Math.min(swipeX / MAX_SWIPE, 1)
            : completingSwipe?.id === t.id && completingSwipe.dir === 'right' ? 1 : 0,
          pointerEvents: 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2.5l1.5 1.5-6 6H3v-1.5l6-6z" />
          </svg>
        </div>
        {/* 左スワイプ背景（完了） */}
        <div style={{
          position: 'absolute', inset: 0, background: '#639922',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '20px',
          opacity: swipingId === t.id && swipeX < 0
            ? Math.min(-swipeX / MAX_SWIPE, 1)
            : completingSwipe?.id === t.id && completingSwipe.dir === 'left' ? 1 : 0,
          pointerEvents: 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6.5 5,10 11,3" />
          </svg>
        </div>
        <div
          className={[
            'ti',
            t.done ? 'done-i' : '',
            t.type === 'timed' ? 'timed-i' : t.type === 'repeat' ? 'repeat-i' : '',
          ].filter(Boolean).join(' ')}
          style={{
            transform: swipingId === t.id
              ? `translateX(${swipeX}px)`
              : completingSwipe?.id === t.id
                ? `translateX(${completingSwipe.dir === 'right' ? MAX_SWIPE : -MAX_SWIPE}px)`
                : 'translateX(0)',
            transition: swipingId === t.id ? 'none' : 'transform 0.2s ease',
            marginBottom: 0,
          }}
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
          onTouchStart={e => onTouchStart(e, t.id)}
          onTouchMove={onTouchMove}
          onTouchEnd={() => onTouchEnd(t)}
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
              {t.type === 'timed' && (
                <span className={`tp ${!t.done && (t.task_date ?? '') < td && !isCrossMidnightActive(t) ? 'p-dl2-exp' : 'p-dl2'}`}>
                  {!t.done && (t.task_date ?? '') < td && !isCrossMidnightActive(t) ? '期限切れ' : '期限 ' + (t.end_time ?? '')}
                </span>
              )}
              {t.type === 'repeat' && <span className="tp p-rp2">{rLabel(t)}</span>}
              {t.done && <span className="tp p-dn">完了</span>}
            </div>
          </div>
          <div className="ti-acts">
            <button className="ab edt" onClick={() => setEditTask(t)} aria-label="編集">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 2.5l1.5 1.5-6 6H3v-1.5l6-6z" />
              </svg>
            </button>
            {t.type === 'stock' ? (
              <button
                className="ab"
                onClick={() => promoteToToday(t)}
                aria-label="今日やる"
                style={{ fontSize: '10px', fontWeight: 700, color: '#D4916E', minWidth: '32px' }}
              >今日</button>
            ) : (
              <button
                className={`ab ck${t.done ? ' on' : ''}`}
                onClick={() => toggleDone(t)}
                aria-label={t.done ? '未完了に戻す' : '完了にする'}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={t.done ? '#639922' : '#B4B2A9'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="2,6.5 5,10 11,3" />
                </svg>
              </button>
            )}
            <button className="ab del" onClick={() => deleteTask(t.id)} aria-label="削除">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="3" x2="10" y2="10" /><line x1="10" y1="3" x2="3" y2="10" />
              </svg>
            </button>
          </div>
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
        {undone.map(t => renderTaskItem(t))}
        {stockTasks.length > 0 && (
          <>
            <button
              onClick={() => setStockOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '8px 4px', marginTop: '4px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="8" height="6" rx="1" /><path d="M4 4V3a2 2 0 014 0v1" />
              </svg>
              <span style={{ color: '#7F77DD', fontWeight: 600 }}>ストック（{stockTasks.length}件）</span>
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round"
                style={{ marginLeft: 'auto', transform: stockOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <polyline points="2,3.5 5,6.5 8,3.5" />
              </svg>
            </button>
            {stockOpen && stockTasks.map(t => renderTaskItem(t))}
          </>
        )}
        {done.length > 0 && (
          <>
            <button
              onClick={() => setDoneOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '8px 4px', marginTop: '4px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#999', fontSize: '12px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#639922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,5.5 4.5,8.5 10,2.5" />
              </svg>
              <span style={{ color: '#639922', fontWeight: 600 }}>完了済み（{done.length}件）</span>
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round"
                style={{ marginLeft: 'auto', transform: doneOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <polyline points="2,3.5 5,6.5 8,3.5" />
              </svg>
            </button>
            {doneOpen && done.map(t => renderTaskItem(t))}
          </>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
        <button className="start-btn" onClick={onShowFocus}>この順番でスタート →</button>
      </div>
      </div>
    </div>
  );
}
