import { useState, useEffect, useRef } from 'react';
import { useTask } from '../context/TaskContext';
import type { Task } from '../types';

const RUNIT_JP: Record<string, string> = { hour: '時間', day: '日', week: '週', month: 'ヶ月' };
const WDAYS_JP = ['月', '火', '水', '木', '金', '土', '日'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function now() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function addMin(t: string, m: number) {
  const [h, mn] = t.split(':').map(Number);
  const tot = h * 60 + mn + m;
  return pad(Math.floor(tot / 60) % 24) + ':' + pad(tot % 60);
}
function tLeft(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  const d = bh * 60 + bm - (ah * 60 + am);
  return d <= 0 ? '期限切れ' : d < 60 ? d + '分' : Math.floor(d / 60) + '時間' + (d % 60) + '分';
}
function rLabel(t: Task) {
  const w = t.wdays && t.wdays.length ? '（' + t.wdays.map(d => WDAYS_JP[d]).join('') + '）' : '';
  return '毎' + (t.rnum ?? 1) + RUNIT_JP[t.runit ?? 'day'] + w + ' ' + (t.rtime ?? '');
}

interface Props {
  username: string;
  onLogout: () => void;
  onShowList: () => void;
  onShowCal: () => void;
  onShowDone: () => void;
}

export function FocusScreen({ username, onLogout, onShowList: _onShowList, onShowCal: _onShowCal, onShowDone }: Props) {
  const { state, completeTask, skipTask } = useTask();
  const { tasks } = state;

  const [clockStr, setClockStr] = useState(now());
  const [nextStr, setNextStr] = useState('次の予定：なし');
  const [intU, setIntU] = useState<Task | null>(null);
  const [intR, setIntR] = useState<Task | null>(null);
  const [dimmedU, setDimmedU] = useState(false);
  const [dimmedR, setDimmedR] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [burst, setBurst] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const todayStr = today();

  // ListScreenと同じフィルター
  const todayTasks = tasks.filter(t => {
    if (t.type === 'timed') return t.task_date === todayStr;
    if (t.type === 'repeat') return true;
    // 通常タスク: 完了済みは今日のみ、未完了は日付なし or 今日
    if (t.done) return t.task_date === todayStr;
    return !t.task_date || t.task_date === todayStr;
  });
  const doneN = todayTasks.filter(t => t.done).length;
  const totalN = todayTasks.length;
  const pct = totalN > 0 ? Math.round((doneN / totalN) * 100) : 0;
  const normalTasks = tasks.filter(t => !t.done && t.type === 'normal' && (!t.task_date || t.task_date === todayStr));
  const currentTask = normalTasks[0] ?? null;

  useEffect(() => {
    const tick = () => {
      const n = now();
      setClockStr(n);

      // 次の予定：時刻付きタスク（timed/repeat）を優先、なければ次の通常タスク
      const timedNext = tasks.filter(t => !t.done && (
        (t.type === 'timed' && t.task_date === today() && (t.end_time ?? '') > n) ||
        (t.type === 'repeat' && (t.rtime ?? '') > n)
      ));
      if (timedNext.length > 0) {
        timedNext.sort((a, b) => {
          const ta = a.type === 'timed' ? (a.end_time ?? '') : (a.rtime ?? '');
          const tb = b.type === 'timed' ? (b.end_time ?? '') : (b.rtime ?? '');
          return ta < tb ? -1 : 1;
        });
        const nx = timedNext[0];
        const t = nx.type === 'timed' ? (nx.end_time ?? '') : (nx.rtime ?? '');
        setNextStr('次の予定：' + t + ' ' + nx.name);
      } else {
        // 通常タスクの2番目（currentTaskの次）を表示
        const normals = tasks.filter(t => !t.done && t.type === 'normal' && (!t.task_date || t.task_date === today()));
        const nextNormal = normals[1] ?? normals[0] ?? null;
        if (nextNormal) {
          setNextStr('次の予定：' + nextNormal.name);
        } else {
          setNextStr('次の予定：なし');
        }
      }

      // 割り込み: 期限あり
      const u = tasks.find(t => !t.done && t.type === 'timed' && t.task_date === today() &&
        n >= addMin(t.end_time ?? '23:59', -(t.alert_min ?? 15)) && n <= (t.end_time ?? ''));
      setIntU(u ?? null);

      // 割り込み: 定期
      const r = tasks.find(t => !t.done && t.type === 'repeat' && n >= (t.rtime ?? '') && n <= addMin(t.rtime ?? '', 2));
      setIntR(r ?? null);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tasks]);

  async function handleComplete() {
    if (!currentTask || completing) return;
    setCompleting(true);
    setBurst(true);
    setTimeout(() => setBurst(false), 500);

    if (popRef.current) {
      popRef.current.classList.remove('fly');
      void popRef.current.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        popRef.current?.classList.add('fly');
      }));
    }

    try {
      await completeTask(currentTask);
    } finally {
      setCompleting(false);
    }
  }

  function doInt(_task: Task, which: 'u' | 'r') {
    if (which === 'u') setDimmedU(true);
    else setDimmedR(true);
  }

  const d = new Date();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + days[d.getDay()] + '曜日';

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="topbar topbar-accent" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <span className="tb-title tb-title-accent">{dateStr}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>{username}</span>
          <button
            style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer' }}
            onClick={onLogout}
          >ログアウト</button>
        </div>
      </div>
      <div style={{ padding: '14px 14px 4px', display: 'flex', flexDirection: 'column', flex: 1 }}>

      <div className="clock-bar">
        <span className="clock-time">{clockStr}</span>
        <span className="clock-next">{nextStr}</span>
      </div>

      {/* 期限あり割り込み */}
      {intU && !dimmedU && (
        <div className="interrupt int-urgent active">
          <div className="int-icon int-icon-u">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <circle cx="8" cy="8" r="6"/><line x1="8" y1="4.5" x2="8" y2="8.5"/><circle cx="8" cy="11" r=".7" fill="#fff"/>
            </svg>
          </div>
          <div className="int-body">
            <div className="int-badge ib-u">{tLeft(clockStr, intU.end_time ?? '')}で期限切れ！</div>
            <div className="int-name">{intU.name}</div>
            <div className="int-sub">終了：{intU.end_time}まで</div>
          </div>
          <div className="int-acts">
            <button className="ib ib-do" onClick={() => doInt(intU, 'u')}>今やる</button>
            <button className="ib ib-later" onClick={() => setDimmedU(true)}>後で</button>
          </div>
        </div>
      )}

      {/* 定期タスク割り込み */}
      {intR && !dimmedR && (
        <div className="interrupt int-routine active">
          <div className="int-icon int-icon-r">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <circle cx="8" cy="8" r="6"/><polyline points="8,4.5 8,8 11,9.5"/>
            </svg>
          </div>
          <div className="int-body">
            <div className="int-badge ib-r">定期タスクの時間です</div>
            <div className="int-name">{intR.name}</div>
            <div className="int-sub">{rLabel(intR)}</div>
          </div>
          <div className="int-acts">
            <button className="ib ib-do-r" onClick={() => doInt(intR, 'r')}>今やる</button>
            <button className="ib ib-later" onClick={() => setDimmedR(true)}>後で</button>
          </div>
        </div>
      )}

      {/* プログレスバー */}
      <div className="prog-row">
        <div className="prog-bar"><div className="prog-fill" style={{ width: pct + '%' }} /></div>
        <span className="prog-txt">{doneN} / {totalN}</span>
      </div>

      {/* フォーカスカード */}
      {currentTask ? (
        <div className={`focus-card${currentTask.type === 'timed' ? ' is-timed' : currentTask.type === 'repeat' ? ' is-repeat' : ''}`}>
          {currentTask.type === 'timed' && (
            <div className="dl-ribbon">終了 {currentTask.end_time} まで</div>
          )}
          <div className="burst">
            <div className={`bring${burst ? ' go' : ''}`} />
          </div>
          <div className="pop fly" ref={popRef}>完了！</div>
          <div className="f-hint">今やること</div>
          <div className="f-name">{currentTask.name}</div>
          <div className="f-pills">
            <span className="pill p-time">{currentTask.dur}</span>
            <span className="pill p-cat">{currentTask.cat}</span>
            {currentTask.type === 'timed' && <span className="pill p-dl">期限 {currentTask.end_time}</span>}
            {currentTask.type === 'repeat' && <span className="pill p-rep">{rLabel(currentTask)}</span>}
          </div>
          <button
            className="done-btn"
            style={{ background: completing ? 'var(--gr)' : '' }}
            onClick={handleComplete}
            disabled={completing}
          >
            {completing ? '✓ できた！' : 'できた！'}
          </button>
        </div>
      ) : (
        <div className="focus-card">
          <div className="f-hint">今やること</div>
          <div className="f-name">今日のタスクはすべて完了！</div>
          <div className="f-pills" />
          <button className="done-btn" onClick={onShowDone}>まとめを見る</button>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingBottom: '4px', display: 'flex', justifyContent: 'center' }}>
        <button className="sub-btn" onClick={skipTask} style={{ fontSize: '12px', color: 'var(--t2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>このタスクを後で ›</button>
      </div>
      </div>
    </div>
  );
}
