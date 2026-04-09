import { db } from './db.js'

await db.executeMultiple(`
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
  streak_date  TEXT    NOT NULL UNIQUE,
  completed    INTEGER NOT NULL DEFAULT 0
);
`)

console.log('Migration complete.')
process.exit(0)
