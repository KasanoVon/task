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
  end_date    TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date  TEXT    NOT NULL,
  task_id   INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  task_name TEXT    NOT NULL,
  task_type TEXT    NOT NULL DEFAULT 'normal',
  dur       TEXT,
  done      INTEGER NOT NULL DEFAULT 0,
  logged_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

`)

await db.execute('PRAGMA foreign_keys = ON')

// 既存 DB 向けカラム追加（列が既にある場合のエラーは無視）
const addCols = ['ALTER TABLE tasks ADD COLUMN end_date TEXT']
for (const sql of addCols) {
  try { await db.execute(sql) } catch (_) {}
}

// daily_logs.task_id を nullable FK に移行
try {
  const info = await db.execute('PRAGMA table_info(daily_logs)')
  const col = info.rows.find(r => r.name === 'task_id')
  if (col && Number(col.notnull) === 1) {
    await db.execute('DROP TABLE IF EXISTS daily_logs_new')
    await db.execute(`
      CREATE TABLE daily_logs_new (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        log_date  TEXT    NOT NULL,
        task_id   INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        task_name TEXT    NOT NULL,
        task_type TEXT    NOT NULL DEFAULT 'normal',
        dur       TEXT,
        done      INTEGER NOT NULL DEFAULT 0,
        logged_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await db.execute(`
      INSERT INTO daily_logs_new
      SELECT dl.id, dl.user_id, dl.log_date,
        CASE WHEN t.id IS NULL THEN NULL ELSE dl.task_id END,
        dl.task_name, dl.task_type, dl.dur, dl.done, dl.logged_at
      FROM daily_logs dl
      LEFT JOIN tasks t ON t.id = dl.task_id
    `)
    await db.execute('DROP TABLE daily_logs')
    await db.execute('ALTER TABLE daily_logs_new RENAME TO daily_logs')
    console.log('daily_logs: task_id を nullable FK に変更しました')
  }
} catch (e) {
  console.error('daily_logs FK 移行エラー:', e)
}

// streaks テーブルが残っていれば daily_logs に統合して削除
try {
  const hasTbl = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='streaks'")
  if (hasTbl.rows.length > 0) {
    await db.execute(`
      INSERT INTO daily_logs (user_id, log_date, task_id, task_name, task_type, dur, done, logged_at)
      SELECT s.user_id, s.streak_date, NULL, '(移行)', 'normal', '', 1,
             s.streak_date || 'T00:00:00.000Z'
      FROM streaks s
      WHERE s.completed > 0
        AND NOT EXISTS (
          SELECT 1 FROM daily_logs dl
          WHERE dl.user_id = s.user_id AND dl.log_date = s.streak_date
        )
    `)
    await db.execute('DROP TABLE IF EXISTS streaks')
    console.log('streaks テーブルを daily_logs に統合しました')
  }
} catch (e) {
  console.error('streaks 移行エラー:', e)
}

console.log('マイグレーション完了。')
process.exit(0)
