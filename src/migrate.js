import { createClient } from '@libsql/client'
import 'dotenv/config'

const db = createClient({
  url: process.env.TURSO_URL ?? `file:./server/task.db`,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

await db.executeMultiple(`
CREATE TABLE IF NOT EXISTS users (
  id           TEXT    PRIMARY KEY,
  username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT   NOT NULL,
  recovery_code_hash TEXT,
  created_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token        TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL,
  expires_at   INTEGER NOT NULL,
  created_at   TEXT    NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  diff        TEXT    NOT NULL DEFAULT 'mid',
  cat         TEXT    NOT NULL DEFAULT 'その他',
  dur         TEXT    NOT NULL DEFAULT '10分',
  type        TEXT    NOT NULL DEFAULT 'normal',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  done        INTEGER NOT NULL DEFAULT 0,
  task_date   TEXT,
  start_time  TEXT,
  end_time    TEXT,
  alert_min   INTEGER DEFAULT 15,
  runit       TEXT,
  rnum        INTEGER DEFAULT 1,
  rtime       TEXT,
  wdays       TEXT    DEFAULT '[]',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date  TEXT    NOT NULL,
  task_id   INTEGER NOT NULL,
  task_name TEXT    NOT NULL,
  task_type TEXT    NOT NULL DEFAULT 'normal',
  dur       TEXT,
  done      INTEGER NOT NULL DEFAULT 0,
  logged_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS streaks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak_date  TEXT    NOT NULL,
  completed    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, streak_date)
);
`)

console.log('マイグレーション完了。')
process.exit(0)
