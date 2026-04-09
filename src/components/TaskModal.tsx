import { useState } from 'react';
import { useTask } from '../context/TaskContext';

const WDAYS_JP = ['月', '火', '水', '木', '金', '土', '日'];

interface Props {
  onClose: () => void;
}

type TaskType = 'normal' | 'timed' | 'repeat';

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function TaskModal({ onClose }: Props) {
  const { addTask } = useTask();
  const [name, setName] = useState('');
  const [diff, setDiff] = useState('mid');
  const [cat, setCat] = useState('その他');
  const [dur, setDur] = useState('10分');
  const [ftype, setFtype] = useState<TaskType>('normal');

  // timed
  const [taskDate, setTaskDate] = useState(today());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [alertMin, setAlertMin] = useState(15);

  // repeat
  const [runit, setRunit] = useState('day');
  const [rnum, setRnum] = useState(1);
  const [rtime, setRtime] = useState('08:00');
  const [wdays, setWdays] = useState<number[]>([]);

  const RUNIT_JP: Record<string, string> = { hour: '時間', day: '日', week: '週', month: 'ヶ月' };

  function toggleWday(d: number) {
    setWdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  async function handleSave() {
    if (!name.trim()) return;
    const base = { name: name.trim(), diff, cat, dur };
    let body = {};
    if (ftype === 'timed') {
      body = { ...base, type: 'timed', task_date: taskDate || today(), start_time: startTime, end_time: endTime, alert_min: alertMin };
    } else if (ftype === 'repeat') {
      body = { ...base, type: 'repeat', runit, rnum, rtime, wdays };
    } else {
      body = { ...base, type: 'normal' };
    }
    await addTask(body);
    onClose();
  }

  return (
    <div className="add-form open" style={{ marginBottom: '14px' }}>
      <div className="fg">
        <input
          className="fi"
          placeholder="タスク名を入力..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <div className="frow">
          <select value={diff} onChange={e => setDiff(e.target.value)}>
            <option value="easy">かんたん</option>
            <option value="mid">ふつう</option>
            <option value="hard">むずかしい</option>
          </select>
          <select value={cat} onChange={e => setCat(e.target.value)}>
            <option>そうじ</option>
            <option>かたづけ</option>
            <option>料理</option>
            <option>健康</option>
            <option>その他</option>
          </select>
          <select value={dur} onChange={e => setDur(e.target.value)}>
            <option>5分</option>
            <option>10分</option>
            <option>20分</option>
            <option>30分</option>
            <option>60分</option>
          </select>
        </div>
        <div className="type-tabs">
          {(['normal', 'timed', 'repeat'] as TaskType[]).map(t => (
            <button
              key={t}
              className={`ttab${ftype === t ? ' on' : ''}`}
              onClick={() => setFtype(t)}
            >
              {t === 'normal' ? '通常' : t === 'timed' ? '期限あり' : '定期くりかえし'}
            </button>
          ))}
        </div>

        {/* 期限あり */}
        {ftype === 'timed' && (
          <div className="ef open">
            <span className="flbl">日付・開始・終了</span>
            <div className="frow">
              <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} />
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
            <span className="flbl">割り込み通知</span>
            <div className="frow">
              <select value={alertMin} onChange={e => setAlertMin(Number(e.target.value))}>
                <option value={5}>5分前</option>
                <option value={15}>15分前</option>
                <option value={30}>30分前</option>
                <option value={60}>1時間前</option>
              </select>
            </div>
          </div>
        )}

        {/* 定期くりかえし */}
        {ftype === 'repeat' && (
          <div className="ef open">
            <span className="flbl">くりかえし</span>
            <div className="frow">
              <select value={runit} onChange={e => setRunit(e.target.value)}>
                <option value="hour">時間ごと</option>
                <option value="day">日ごと</option>
                <option value="week">週ごと</option>
                <option value="month">月ごと</option>
              </select>
              <input
                type="number"
                value={rnum}
                min={1}
                max={99}
                style={{ maxWidth: '60px' }}
                onChange={e => setRnum(parseInt(e.target.value) || 1)}
              />
              <span style={{ fontSize: '12px', color: 'var(--t2)', alignSelf: 'center' }}>
                {RUNIT_JP[runit]}
              </span>
            </div>
            {runit === 'week' && (
              <>
                <span className="flbl">曜日</span>
                <div className="wdays" style={{ marginTop: '4px' }}>
                  {WDAYS_JP.map((label, idx) => (
                    <div
                      key={idx}
                      className={`wd${wdays.includes(idx) ? ' on' : ''}`}
                      onClick={() => toggleWday(idx)}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </>
            )}
            <span className="flbl">通知時刻</span>
            <div className="frow">
              <input type="time" value={rtime} onChange={e => setRtime(e.target.value)} />
            </div>
          </div>
        )}

        <div className="fbtns">
          <button className="fcancel" onClick={onClose}>キャンセル</button>
          <button className="fsave" onClick={handleSave}>追加する</button>
        </div>
      </div>
    </div>
  );
}
