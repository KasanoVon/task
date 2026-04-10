import { useState } from 'react';
import { useTask } from '../context/TaskContext';
import { DurationPicker } from './DurationPicker';
import { CategoryPicker } from './CategoryPicker';
import { DifficultyPicker } from './DifficultyPicker';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import { RunitPicker } from './RunitPicker';
import { AlertMinPicker } from './AlertMinPicker';
import type { Task } from '../types';

const WDAYS_JP = ['月', '火', '水', '木', '金', '土', '日'];

interface Props {
    onClose: () => void;
    task?: Task; // 既存タスクを渡すと編集モードになる
}

type TaskType = 'normal' | 'timed' | 'repeat';

function today() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

const ALERT_LABELS: Record<number, string> = { 5: '5分前', 15: '15分前', 30: '30分前', 60: '1時間前' };
const RUNIT_JP: Record<string, string> = { hour: '時間ごと', day: '日ごと', week: '週ごと', month: '月ごと' };

export function TaskModal({ onClose, task }: Props) {
    const { addTask, updateTask } = useTask();
    const isEdit = !!task;

    const [name, setName] = useState(task?.name ?? '');
    const [diff, setDiff] = useState<'easy' | 'mid' | 'hard'>(task?.diff ?? 'mid');
    const [cat, setCat] = useState(task?.cat ?? 'その他');
    const [dur, setDur] = useState(task?.dur ?? '10分');
    const [durPickerOpen, setDurPickerOpen] = useState(false);
    const [catPickerOpen, setCatPickerOpen] = useState(false);
    const [diffPickerOpen, setDiffPickerOpen] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [ftype, setFtype] = useState<TaskType>((task?.type as TaskType) ?? 'normal');

    // timed
    const [taskDate, setTaskDate] = useState(task?.task_date ?? today());
    const [startTime, setStartTime] = useState(task?.start_time ?? '09:00');
    const [endTime, setEndTime] = useState(task?.end_time ?? '10:00');
    const [alertMin, setAlertMin] = useState(task?.alert_min ?? 15);
    const [startTimePickerOpen, setStartTimePickerOpen] = useState(false);
    const [endTimePickerOpen, setEndTimePickerOpen] = useState(false);
    const [alertMinPickerOpen, setAlertMinPickerOpen] = useState(false);

    // repeat
    const [runit, setRunit] = useState(task?.runit ?? 'day');
    const [rnum, setRnum] = useState(task?.rnum ?? 1);
    const [rtime, setRtime] = useState(task?.rtime ?? '08:00');
    const [wdays, setWdays] = useState<number[]>(task?.wdays ?? []);
    const [rtimePickerOpen, setRtimePickerOpen] = useState(false);
    const [runitPickerOpen, setRunitPickerOpen] = useState(false);

    function toggleWday(d: number) {
        setWdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    }

    async function handleSave() {
        if (!name.trim()) return;
        const base = { name: name.trim(), diff, cat, dur };
        let body: Partial<Task> = {};
        if (ftype === 'timed') {
            body = { ...base, type: 'timed', task_date: taskDate || today(), start_time: startTime, end_time: endTime, alert_min: alertMin };
        } else if (ftype === 'repeat') {
            body = { ...base, type: 'repeat', runit, rnum, rtime, wdays };
        } else {
            body = { ...base, type: 'normal', task_date: taskDate || today() };
        }
        if (isEdit) {
            await updateTask(task!.id, body);
        } else {
            await addTask(body);
        }
        onClose();
    }

    // ボタン共通スタイル
    const pickerBtn = {
        fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
        border: '1px solid var(--bd2)', background: 'var(--bg)',
        color: 'var(--t)', cursor: 'pointer',
    };

    return (
        <>
        {durPickerOpen && (
            <DurationPicker
                value={dur}
                onConfirm={v => { setDur(v); setDurPickerOpen(false); }}
                onCancel={() => setDurPickerOpen(false)}
            />
        )}
        {catPickerOpen && (
            <CategoryPicker
                value={cat}
                onSelect={v => { setCat(v); setCatPickerOpen(false); }}
                onCancel={() => setCatPickerOpen(false)}
            />
        )}
        {diffPickerOpen && (
            <DifficultyPicker
                value={diff}
                onSelect={v => { setDiff(v); setDiffPickerOpen(false); }}
                onCancel={() => setDiffPickerOpen(false)}
            />
        )}
        {datePickerOpen && (
            <DatePicker
                value={taskDate}
                onSelect={v => { setTaskDate(v); setDatePickerOpen(false); }}
                onCancel={() => setDatePickerOpen(false)}
            />
        )}
        {startTimePickerOpen && (
            <TimePicker
                value={startTime}
                title="開始時刻"
                onConfirm={v => { setStartTime(v); setStartTimePickerOpen(false); }}
                onCancel={() => setStartTimePickerOpen(false)}
            />
        )}
        {endTimePickerOpen && (
            <TimePicker
                value={endTime}
                title="終了時刻"
                onConfirm={v => { setEndTime(v); setEndTimePickerOpen(false); }}
                onCancel={() => setEndTimePickerOpen(false)}
            />
        )}
        {alertMinPickerOpen && (
            <AlertMinPicker
                value={alertMin}
                onSelect={v => { setAlertMin(v); setAlertMinPickerOpen(false); }}
                onCancel={() => setAlertMinPickerOpen(false)}
            />
        )}
        {rtimePickerOpen && (
            <TimePicker
                value={rtime}
                title="通知時刻"
                onConfirm={v => { setRtime(v); setRtimePickerOpen(false); }}
                onCancel={() => setRtimePickerOpen(false)}
            />
        )}
        {runitPickerOpen && (
            <RunitPicker
                value={runit as 'hour' | 'day' | 'week' | 'month'}
                onSelect={v => { setRunit(v); setRunitPickerOpen(false); }}
                onCancel={() => setRunitPickerOpen(false)}
            />
        )}
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
                    <button type="button" onClick={() => setDiffPickerOpen(true)} style={{ ...pickerBtn, minWidth: '70px' }}>
                        {{ easy: '簡単', mid: '普通', hard: '難しい' }[diff]}
                    </button>
                    <button type="button" onClick={() => setCatPickerOpen(true)} style={{ ...pickerBtn, minWidth: '80px' }}>
                        {cat}
                    </button>
                    <button type="button" onClick={() => setDurPickerOpen(true)} style={{ ...pickerBtn, minWidth: '70px' }}>
                        {dur}
                    </button>
                </div>
                <div className="type-tabs">
                    {(['normal', 'timed', 'repeat'] as TaskType[]).map(t => (
                        <button
                            key={t}
                            className={`ttab${ftype === t ? ' on' : ''}`}
                            onClick={() => setFtype(t)}
                        >
                            {t === 'normal' ? '通常' : t === 'timed' ? '期限あり' : '定期繰り返し'}
                        </button>
                    ))}
                </div>

                {/* 期限あり */}
                {ftype === 'timed' && (
                    <div className="ef open" style={{ gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="flbl" style={{ minWidth: '68px', marginBottom: 0 }}>日付</span>
                            <button type="button" onClick={() => setDatePickerOpen(true)} style={pickerBtn}>{taskDate}</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="flbl" style={{ minWidth: '68px', marginBottom: 0 }}>開始・終了</span>
                            <button type="button" onClick={() => setStartTimePickerOpen(true)} style={pickerBtn}>{startTime}</button>
                            <span style={{ fontSize: '12px', color: 'var(--t2)' }}>〜</span>
                            <button type="button" onClick={() => setEndTimePickerOpen(true)} style={pickerBtn}>{endTime}</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="flbl" style={{ minWidth: '68px', marginBottom: 0 }}>割り込み通知</span>
                            <button type="button" onClick={() => setAlertMinPickerOpen(true)} style={pickerBtn}>
                                {ALERT_LABELS[alertMin] ?? alertMin + '分前'}
                            </button>
                        </div>
                    </div>
                )}

                {/* 定期繰り返し */}
                {ftype === 'repeat' && (
                    <div className="ef open" style={{ gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="flbl" style={{ minWidth: '68px', marginBottom: 0 }}>繰り返し</span>
                            <button type="button" onClick={() => setRunitPickerOpen(true)} style={pickerBtn}>{RUNIT_JP[runit] ?? runit}</button>
                            <input
                                type="number"
                                value={rnum}
                                min={1}
                                max={99}
                                style={{ maxWidth: '52px', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--bd2)', background: 'var(--bg)', color: 'var(--t)', outline: 'none' }}
                                onChange={e => setRnum(parseInt(e.target.value) || 1)}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--t2)' }}>回</span>
                        </div>
                        {runit === 'week' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="flbl" style={{ minWidth: '68px', marginBottom: 0 }}>曜日</span>
                                <div className="wdays">
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
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="flbl" style={{ minWidth: '68px', marginBottom: 0 }}>通知時刻</span>
                            <button type="button" onClick={() => setRtimePickerOpen(true)} style={pickerBtn}>{rtime}</button>
                        </div>
                    </div>
                )}

                {/* 通常タスクの日付指定 */}
                {ftype === 'normal' && (
                    <div className="ef open" style={{ gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="flbl" style={{ minWidth: '68px', marginBottom: 0 }}>実施日</span>
                            <button type="button" onClick={() => setDatePickerOpen(true)} style={pickerBtn}>{taskDate}</button>
                        </div>
                    </div>
                )}

                <div className="fbtns">
                    <button className="fcancel" onClick={onClose}>キャンセル</button>
                    <button className="fsave" onClick={handleSave}>{isEdit ? '保存する' : '追加する'}</button>
                </div>
            </div>
        </div>
        </>
    );
}
