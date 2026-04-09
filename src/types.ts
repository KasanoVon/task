// ユーザー型
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

// タスク型
export interface Task {
  id: number;
  user_id: string;
  name: string;
  diff: 'easy' | 'mid' | 'hard';
  cat: string;
  dur: string;
  type: 'normal' | 'timed' | 'repeat';
  sort_order: number;
  done: boolean;
  task_date?: string;
  start_time?: string;
  end_time?: string;
  alert_min?: number;
  runit?: string;
  rnum?: number;
  rtime?: string;
  wdays?: number[];
  created_at: string;
}

// 完了ログ型
export interface DailyLog {
  id: number;
  log_date: string;
  task_id: number;
  task_name: string;
  task_type: string;
  dur: string;
  done: number;
}

// ストリーク行型
export interface StreakRow {
  streak_date: string;
  completed: number;
}
