import crypto from 'node:crypto';

/** 旧フォーマット文字列 or 数値 → 分（整数） */
function parseDurStr(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const hm = s.match(/(\d+)時間(?:(\d+)分)?/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = s.match(/(\d+)分/);
  if (m) return Number(m[1]);
  const n = parseInt(s);
  return isNaN(n) ? 0 : n;
}
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const PORT = Number(process.env.PORT ?? 8787);
const SESSION_DAYS = 30;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://your-app.railway.app';
const LOCAL_DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

// LibSQL クライアント
const tursoUrl = process.env.TURSO_URL ?? `file:${path.join(__dirname, 'task.db')}`;
const client = createClient({
  url: tursoUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// sqlite API 互換ラッパー
const db = {
  get: async (sql, ...args) => {
    const result = await client.execute({ sql, args });
    return result.rows[0] ?? null;
  },
  all: async (sql, ...args) => {
    const result = await client.execute({ sql, args });
    return result.rows;
  },
  run: async (sql, ...args) => {
    const result = await client.execute({ sql, args });
    return result;
  },
};

// 外部キー制約を有効化
await client.execute('PRAGMA foreign_keys = ON');

// テーブル初期化
await client.executeMultiple(`
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
    diff        TEXT    NOT NULL DEFAULT 'mid'     CHECK (diff IN ('easy', 'mid', 'hard')),
    cat         TEXT    NOT NULL DEFAULT 'その他',
    dur         INTEGER NOT NULL DEFAULT 10,
    type        TEXT    NOT NULL DEFAULT 'normal'  CHECK (type IN ('normal', 'timed', 'repeat', 'stock')),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    done        INTEGER NOT NULL DEFAULT 0         CHECK (done IN (0, 1)),
    task_date   TEXT,
    start_time  TEXT,
    end_time    TEXT,
    alert_min   INTEGER DEFAULT 15,
    runit       TEXT                               CHECK (runit IS NULL OR runit IN ('hour', 'day', 'week', 'month')),
    rnum        INTEGER DEFAULT 1,
    rtime       TEXT,
    wdays       TEXT    DEFAULT '[]',
    end_date    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

  CREATE TABLE IF NOT EXISTS daily_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date  TEXT    NOT NULL,
    task_id   INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    task_name TEXT    NOT NULL,
    task_type TEXT    NOT NULL DEFAULT 'normal'   CHECK (task_type IN ('normal', 'timed', 'repeat', 'stock')),
    dur       INTEGER NOT NULL DEFAULT 0,
    done      INTEGER NOT NULL DEFAULT 0          CHECK (done IN (0, 1)),
    logged_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);

`);


// カラム追加マイグレーション（既存の場合は無視）
for (const sql of [
  'ALTER TABLE sessions    ADD COLUMN user_id    TEXT',
  'ALTER TABLE tasks       ADD COLUMN user_id    TEXT',
  'ALTER TABLE tasks       ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE tasks       ADD COLUMN end_date   TEXT',
  'ALTER TABLE daily_logs  ADD COLUMN user_id    TEXT',
  'ALTER TABLE daily_logs  ADD COLUMN log_date   TEXT',
  'ALTER TABLE daily_logs  ADD COLUMN task_type  TEXT NOT NULL DEFAULT \'normal\'',
  'ALTER TABLE daily_logs  ADD COLUMN dur        TEXT NOT NULL DEFAULT \'\'',
]) {
  try { await client.execute(sql); } catch { /* カラムが既に存在する場合は無視 */ }
}

// NULL user_id の無効レコードを削除
await client.execute("DELETE FROM sessions   WHERE user_id IS NULL OR user_id = ''");
await client.execute("DELETE FROM tasks      WHERE user_id IS NULL OR user_id = ''");
await client.execute("DELETE FROM daily_logs WHERE user_id IS NULL OR user_id = ''");

// dur TEXT → INTEGER (minutes) 変換（旧フォーマット行のみ対象）
try {
  const taskDurRows = await client.execute("SELECT id, dur FROM tasks WHERE typeof(dur) = 'text' AND (dur LIKE '%分%' OR dur LIKE '%時間%')");
  for (const row of taskDurRows.rows) {
    await client.execute('UPDATE tasks SET dur = ? WHERE id = ?', [parseDurStr(String(row.dur)), row.id]);
  }
  const logDurRows = await client.execute("SELECT id, dur FROM daily_logs WHERE typeof(dur) = 'text' AND (dur LIKE '%分%' OR dur LIKE '%時間%')");
  for (const row of logDurRows.rows) {
    await client.execute('UPDATE daily_logs SET dur = ? WHERE id = ?', [parseDurStr(String(row.dur)), row.id]);
  }
} catch (e) {
  console.error('dur 変換エラー:', e);
}

// daily_logs.task_id を nullable FK に移行（task_id NOT NULL の場合のみテーブル再作成）
try {
  const info = await client.execute('PRAGMA table_info(daily_logs)');
  const col = info.rows.find(r => r.name === 'task_id');
  if (col && Number(col.notnull) === 1) {
    // 前回の失敗分が残っていれば削除
    await client.execute('DROP TABLE IF EXISTS daily_logs_new');
    await client.execute(`
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
    `);
    await client.execute(`
      INSERT INTO daily_logs_new
      SELECT dl.id, dl.user_id, dl.log_date,
        CASE WHEN t.id IS NULL THEN NULL ELSE dl.task_id END,
        dl.task_name, dl.task_type, dl.dur, dl.done, dl.logged_at
      FROM daily_logs dl
      LEFT JOIN tasks t ON t.id = dl.task_id
    `);
    await client.execute('DROP TABLE daily_logs');
    await client.execute('ALTER TABLE daily_logs_new RENAME TO daily_logs');
    console.log('daily_logs: task_id を nullable FK に変更しました');
  }
} catch (e) {
  console.error('daily_logs FK 移行エラー:', e);
}

// streaks テーブルが残っていれば daily_logs に統合して削除
try {
  const hasTbl = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='streaks'");
  if (hasTbl.rows.length > 0) {
    await client.execute(`
      INSERT INTO daily_logs (user_id, log_date, task_id, task_name, task_type, dur, done, logged_at)
      SELECT s.user_id, s.streak_date, NULL, '(移行)', 'normal', '', 1,
             s.streak_date || 'T00:00:00.000Z'
      FROM streaks s
      WHERE s.completed > 0
        AND NOT EXISTS (
          SELECT 1 FROM daily_logs dl
          WHERE dl.user_id = s.user_id AND dl.log_date = s.streak_date
        )
    `);
    await client.execute('DROP TABLE IF EXISTS streaks');
    console.log('streaks テーブルを daily_logs に統合しました');
  }
} catch (e) {
  console.error('streaks 移行エラー:', e);
}

console.log('マイグレーション完了');

const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [ALLOWED_ORIGIN, ...LOCAL_DEV_ORIGINS];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

if (isProd) {
  app.use(express.static(distPath));
}

// ── 認証ユーティリティ ──────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'too_many_requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getTokenFromRequest(req) {
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie('auth_token', { path: '/' });
}

function sanitizeUser(userRow) {
  return {
    id: userRow.id,
    username: userRow.username,
    createdAt: userRow.created_at,
  };
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.run(
    'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    token, userId, expiresAt, new Date().toISOString()
  );
  return { token, expiresAt };
}

async function deleteExpiredSessions() {
  await db.run('DELETE FROM sessions WHERE expires_at <= ?', Date.now());
}

async function getAuthUser(req) {
  await deleteExpiredSessions();
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const row = await db.get(
    `SELECT u.id, u.username, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token, Date.now()
  );
  return row ?? null;
}

// 認証ミドルウェア
async function requireAuth(req, res, next) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

// ── 認証エンドポイント ──────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (username.length < 2 || username.length > 32 || password.length < 6) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const existing = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', username);
    if (existing) return res.status(409).json({ error: 'username_taken' });

    const id = crypto.randomUUID().replace(/-/g, '');
    const createdAt = new Date().toISOString().slice(0, 10);
    const passwordHash = await bcrypt.hash(password, 10);
    const recoveryCode = crypto.randomBytes(18).toString('base64url');
    const recoveryCodeHash = await bcrypt.hash(recoveryCode, 10);

    await db.run(
      'INSERT INTO users (id, username, password_hash, recovery_code_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      id, username, passwordHash, recoveryCodeHash, createdAt
    );

    const session = await createSession(id);
    setAuthCookie(res, session.token);
    return res.json({ user: { id, username, createdAt }, token: session.token, recoveryCode });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!username || !password) return res.status(400).json({ error: 'invalid_input' });

    const userRow = await db.get(
      'SELECT id, username, password_hash, created_at FROM users WHERE username = ? COLLATE NOCASE',
      username
    );
    if (!userRow) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const session = await createSession(userRow.id);
    setAuthCookie(res, session.token);
    return res.json({ user: sanitizeUser(userRow), token: session.token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const row = await getAuthUser(req);
    if (!row) return res.status(401).json({ error: 'unauthorized' });
    const token = getTokenFromRequest(req);
    if (token && !req.cookies?.auth_token) setAuthCookie(res, token);
    return res.json({ user: sanitizeUser(row) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = getTokenFromRequest(req);
    if (token) await db.run('DELETE FROM sessions WHERE token = ?', token);
    clearAuthCookie(res);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const recoveryCode = String(req.body?.recoveryCode ?? '');
    const newPassword = String(req.body?.newPassword ?? '');
    if (!username || !recoveryCode || newPassword.length < 6) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const userRow = await db.get(
      'SELECT id, recovery_code_hash FROM users WHERE username = ? COLLATE NOCASE', username
    );
    if (!userRow) return res.status(401).json({ error: 'invalid_credentials' });
    if (!userRow.recovery_code_hash) return res.status(404).json({ error: 'no_recovery_code' });

    const codeOk = await bcrypt.compare(recoveryCode, userRow.recovery_code_hash);
    if (!codeOk) return res.status(401).json({ error: 'invalid_credentials' });

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const result = await db.run(
      'UPDATE users SET password_hash = ?, recovery_code_hash = NULL WHERE id = ? AND recovery_code_hash IS NOT NULL',
      newPasswordHash, userRow.id
    );
    if (result.rowsAffected === 0) return res.status(401).json({ error: 'invalid_credentials' });
    await db.run('DELETE FROM sessions WHERE user_id = ?', userRow.id);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/setup-recovery-code', requireAuth, async (req, res) => {
  try {
    const recoveryCode = crypto.randomBytes(18).toString('base64url');
    const recoveryCodeHash = await bcrypt.hash(recoveryCode, 10);
    await db.run('UPDATE users SET recovery_code_hash = ? WHERE id = ?', recoveryCodeHash, req.user.id);
    return res.json({ recoveryCode });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── タスク API ──────────────────────────────────────────

function parseTask(row) {
  return {
    ...row,
    done: Boolean(row.done),
    dur: parseDurStr(row.dur),
    wdays: (() => {
      try { return JSON.parse(row.wdays || '[]'); } catch { return []; }
    })(),
  };
}

// タスク一覧取得
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
      req.user.id
    );
    return res.json(rows.map(parseTask));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// タスク作成
app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    const maxOrder = await db.get('SELECT MAX(sort_order) as m FROM tasks WHERE user_id = ?', req.user.id);
    const sortOrder = (maxOrder?.m ?? -1) + 1;
    const result = await db.run(
      `INSERT INTO tasks
        (user_id, name, diff, cat, dur, type, sort_order, task_date, start_time, end_time, alert_min, runit, rnum, rtime, wdays, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id,
      String(b.name ?? ''),
      String(b.diff ?? 'mid'),
      String(b.cat ?? 'その他'),
      String(b.dur ?? '10分'),
      String(b.type ?? 'normal'),
      sortOrder,
      b.task_date ?? null,
      b.start_time ?? null,
      b.end_time ?? null,
      b.alert_min ?? 15,
      b.runit ?? null,
      b.rnum ?? 1,
      b.rtime ?? null,
      JSON.stringify(b.wdays ?? []),
      b.end_date ?? null
    );
    const newTask = await db.get('SELECT * FROM tasks WHERE id = ?', result.lastInsertRowid);
    return res.json(parseTask(newTask));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// タスク並び替え
app.patch('/api/tasks/reorder', requireAuth, async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'invalid_input' });
    for (let i = 0; i < ids.length; i++) {
      await db.run(
        'UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?',
        i, ids[i], req.user.id
      );
    }
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// タスク部分更新
app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body ?? {};

    // 通常タスクをdone=1にする際、task_dateが未設定なら今日の日付を自動セット
    if (b.done === 1) {
      const existing = await db.get('SELECT task_date, type FROM tasks WHERE id = ? AND user_id = ?', id, req.user.id);
      if (existing && existing.type === 'normal' && !existing.task_date) {
        b.task_date = new Date().toISOString().slice(0, 10);
      }
    }

    const allowed = ['name', 'diff', 'cat', 'dur', 'type', 'done', 'sort_order',
                     'task_date', 'start_time', 'end_time', 'alert_min', 'runit', 'rnum', 'rtime', 'wdays', 'end_date'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (key in b) {
        sets.push(`${key} = ?`);
        vals.push(key === 'wdays' ? JSON.stringify(b[key]) : b[key]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no_fields' });
    vals.push(id, req.user.id);
    await db.run(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
      ...vals
    );
    const updated = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', id, req.user.id);
    return res.json(parseTask(updated));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// タスク削除
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.run('DELETE FROM daily_logs WHERE task_id = ? AND user_id = ?', id, req.user.id);
    await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── 完了ログ API ────────────────────────────────────────

// タスク名候補（tasks + daily_logs の重複排除）
app.get('/api/task-names', requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT name FROM tasks WHERE user_id = ?
       UNION
       SELECT task_name AS name FROM daily_logs WHERE user_id = ? AND task_name IS NOT NULL
       ORDER BY name`,
      req.user.id, req.user.id
    );
    return res.json(rows.map(r => r.name));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

// ログ取得
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    const rows = await db.all(
      'SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ? ORDER BY logged_at DESC',
      req.user.id, date
    );
    return res.json(rows.map(r => ({ ...r, dur: parseDurStr(r.dur) })));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ログ記録
app.post('/api/logs', requireAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    const today = new Date().toISOString().slice(0, 10);
    await db.run(
      'INSERT INTO daily_logs (user_id, log_date, task_id, task_name, task_type, dur, done) VALUES (?, ?, ?, ?, ?, ?, ?)',
      req.user.id, today, b.task_id ?? null, b.task_name, b.task_type ?? 'normal', parseDurStr(b.dur ?? 0), b.done ?? 1
    );
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── ストリーク API ──────────────────────────────────────

app.get('/api/streaks', requireAuth, async (req, res) => {
  try {
    const days = parseInt(String(req.query.days ?? '14'));

    // ドット表示用 rows（days日分）
    const rows = await db.all(
      `SELECT log_date AS streak_date, COUNT(*) AS completed
       FROM daily_logs
       WHERE user_id = ? AND log_date >= date('now', ?)
       GROUP BY log_date
       ORDER BY log_date DESC`,
      req.user.id, `-${days} days`
    );

    // 連続日数計算（最大90日分さかのぼる）
    const allData = await db.all(
      `SELECT log_date AS streak_date
       FROM daily_logs
       WHERE user_id = ? AND log_date >= date('now', '-90 days')
       GROUP BY log_date`,
      req.user.id
    );
    const doneDates = new Set(allData.map(r => r.streak_date));

    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; ; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (ds === today && !doneDates.has(ds)) continue; // 今日未完了でも前日の連続は維持
      if (!doneDates.has(ds)) break;
      streak++;
    }

    return res.json({ streak, rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── 本番: SPA フォールバック ────────────────────────────

if (isProd) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, async () => {
  console.log(`タスクアプリ API 起動中 port ${PORT}`);
  console.log(`DB: ${tursoUrl.startsWith('file:') ? 'local SQLite' : 'Turso cloud'}`);
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  console.log(`ユーザー数: ${userCount?.count ?? 0}`);
});
