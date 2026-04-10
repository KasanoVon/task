import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Task } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// ── 状態 ─────────────────────────────────────────────────

interface TaskState {
  tasks: Task[];
  completedLog: Task[];
  loaded: boolean;
}

type TaskAction =
  | { type: 'LOAD'; payload: Task[] }
  | { type: 'ADD'; payload: Task }
  | { type: 'UPDATE'; payload: Task }
  | { type: 'DELETE'; id: number }
  | { type: 'REORDER'; payload: Task[] }
  | { type: 'LOG_COMPLETE'; payload: Task };

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, tasks: action.payload, loaded: true };
    case 'ADD':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) };
    case 'REORDER':
      return { ...state, tasks: action.payload };
    case 'LOG_COMPLETE':
      return { ...state, completedLog: [...state.completedLog, action.payload] };
    default:
      return state;
  }
}

// ── コンテキスト ─────────────────────────────────────────

interface TaskContextValue {
  state: TaskState;
  loadTasks: () => Promise<void>;
  addTask: (body: Partial<Task>) => Promise<Task>;
  updateTask: (id: number, body: Partial<Task>) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  reorderTasks: (ids: number[]) => Promise<void>;
  completeTask: (task: Task) => Promise<void>;
  skipTask: () => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, {
    tasks: [],
    completedLog: [],
    loaded: false,
  });

  async function apiFetch(method: string, path: string, body?: unknown) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    if (res.status === 204) return null;
    return res.json();
  }

  const loadTasks = useCallback(async () => {
    const tasks = (await apiFetch('GET', '/api/tasks')) as Task[];
    dispatch({ type: 'LOAD', payload: tasks });
  }, []);

  async function addTask(body: Partial<Task>): Promise<Task> {
    const newTask = (await apiFetch('POST', '/api/tasks', body)) as Task;
    dispatch({ type: 'ADD', payload: newTask });
    return newTask;
  }

  async function updateTask(id: number, body: Partial<Task>) {
    // 楽観的更新（APIレスポンス前に即反映）
    const current = state.tasks.find(t => t.id === id);
    if (current) {
      const optimistic: Task = {
        ...current,
        ...body,
        done: 'done' in body ? Boolean((body as Record<string, unknown>).done) : current.done,
      };
      dispatch({ type: 'UPDATE', payload: optimistic });
    }
    const updated = (await apiFetch('PATCH', `/api/tasks/${id}`, body)) as Task;
    dispatch({ type: 'UPDATE', payload: updated });
  }

  async function deleteTask(id: number) {
    await apiFetch('DELETE', `/api/tasks/${id}`);
    dispatch({ type: 'DELETE', id });
  }

  async function reorderTasks(ids: number[]) {
    const reordered = ids
      .map(id => state.tasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined);
    dispatch({ type: 'REORDER', payload: reordered });
    await apiFetch('PATCH', '/api/tasks/reorder', { ids });
  }

  async function completeTask(task: Task) {
    await apiFetch('PATCH', `/api/tasks/${task.id}`, { done: 1 });
    // ログ記録失敗はUIに影響させない
    apiFetch('POST', '/api/logs', {
      task_id: task.id,
      task_name: task.name,
      task_type: task.type,
      dur: task.dur,
      done: 1,
    }).catch(() => {});
    dispatch({ type: 'UPDATE', payload: { ...task, done: true } });
    dispatch({ type: 'LOG_COMPLETE', payload: task });

    // 定期タスクは新しいインスタンスを作成
    if (task.type === 'repeat') {
      const newTask = await addTask({
        name: task.name, diff: task.diff, cat: task.cat, dur: task.dur,
        type: 'repeat', runit: task.runit, rnum: task.rnum, rtime: task.rtime, wdays: task.wdays,
      });
      dispatch({ type: 'ADD', payload: newTask });
    }
  }

  function skipTask() {
    const normals = state.tasks.filter(t => !t.done && t.type === 'normal');
    if (normals.length < 2) return;
    const first = normals[0];
    const second = normals[1];
    const idx = state.tasks.findIndex(t => t.id === first.id);
    const newTasks = [...state.tasks];
    // 1つ下（次の未完了タスクの直後）に移動
    newTasks.splice(idx, 1);
    const insertAt = newTasks.findIndex(t => t.id === second.id) + 1;
    newTasks.splice(insertAt, 0, first);
    dispatch({ type: 'REORDER', payload: newTasks });
  }

  return (
    <TaskContext.Provider value={{ state, loadTasks, addTask, updateTask, deleteTask, reorderTasks, completeTask, skipTask }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTask() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTask must be used within TaskProvider');
  return ctx;
}
