import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { db } from './db.js'

const app = new Hono()

app.use('*', cors())
app.use('/public/*', serveStatic({ root: './' }))
app.get('/', serveStatic({ path: './public/index.html' }))

// ─────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────

// GET /api/tasks  全タスク取得
app.get('/api/tasks', async (c) => {
  const { rows } = await db.execute(
    'SELECT * FROM tasks ORDER BY sort_order ASC, id ASC'
  )
  const tasks = rows.map(parseTask)
  return c.json(tasks)
})

// POST /api/tasks  タスク追加
app.post('/api/tasks', async (c) => {
  const b = await c.req.json()
  const { lastInsertRowid } = await db.execute({
    sql: `INSERT INTO tasks
      (name, diff, cat, dur, type, sort_order,
       task_date, start_time, end_time, alert_min,
       runit, rnum, rtime, wdays, end_date)
      VALUES (?,?,?,?,?,
        (SELECT COALESCE(MAX(sort_order),0)+1 FROM tasks),
        ?,?,?,?,?,?,?,?,?)`,
    args: [
      b.name, b.diff ?? 'mid', b.cat ?? 'その他', b.dur ?? '10分',
      b.type ?? 'normal',
      b.task_date ?? null, b.start_time ?? null, b.end_time ?? null,
      b.alert_min ?? 15,
      b.runit ?? null, b.rnum ?? 1, b.rtime ?? null,
      JSON.stringify(b.wdays ?? []),
      b.end_date ?? null,
    ],
  })
  const { rows } = await db.execute({
    sql: 'SELECT * FROM tasks WHERE id = ?',
    args: [lastInsertRowid],
  })
  return c.json(parseTask(rows[0]), 201)
})

// PATCH /api/tasks/reorder  並べ替え（idの配列を受け取る）
app.patch('/api/tasks/reorder', async (c) => {
  const { ids } = await c.req.json()
  const stmts = ids.map((id, i) => ({
    sql: 'UPDATE tasks SET sort_order = ? WHERE id = ?',
    args: [i, id],
  }))
  await db.batch(stmts)
  return c.json({ ok: true })
})

// PATCH /api/tasks/:id  更新（完了トグル・内容変更）
app.patch('/api/tasks/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json()

  const fields = []
  const args = []
  const allowed = [
    'name','diff','cat','dur','type','done','sort_order',
    'task_date','start_time','end_time','alert_min',
    'runit','rnum','rtime','end_date',
  ]
  for (const key of allowed) {
    if (key in b) { fields.push(`${key} = ?`); args.push(b[key]) }
  }
  if ('wdays' in b) {
    fields.push('wdays = ?')
    args.push(JSON.stringify(b.wdays))
  }
  if (!fields.length) return c.json({ error: 'no fields' }, 400)

  args.push(id)
  await db.execute({ sql: `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, args })
  const { rows } = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [id] })
  return c.json(parseTask(rows[0]))
})

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [id] })
  return c.json({ ok: true })
})

// ─────────────────────────────────────────
// Daily logs
// ─────────────────────────────────────────

// GET /api/logs?date=YYYY-MM-DD
app.get('/api/logs', async (c) => {
  const date = c.req.query('date') ?? today()
  const { rows } = await db.execute({
    sql: 'SELECT * FROM daily_logs WHERE log_date = ? ORDER BY logged_at ASC',
    args: [date],
  })
  return c.json(rows)
})

// POST /api/logs  完了ログを記録
app.post('/api/logs', async (c) => {
  const b = await c.req.json()
  const date = b.log_date ?? today()
  await db.execute({
    sql: `INSERT INTO daily_logs (log_date, task_id, task_name, task_type, dur, done)
          VALUES (?,?,?,?,?,?)`,
    args: [date, b.task_id, b.task_name, b.task_type ?? 'normal', b.dur ?? '', b.done ?? 1],
  })
  // ストリーク更新
  await db.execute({
    sql: `INSERT INTO streaks (streak_date, completed) VALUES (?,1)
          ON CONFLICT(streak_date) DO UPDATE SET completed = completed + 1`,
    args: [date],
  })
  return c.json({ ok: true }, 201)
})

// ─────────────────────────────────────────
// Streaks
// ─────────────────────────────────────────

// GET /api/streaks?days=14  直近N日のストリーク
app.get('/api/streaks', async (c) => {
  const days = Number(c.req.query('days') ?? 14)
  const { rows } = await db.execute({
    sql: `SELECT * FROM streaks
          WHERE streak_date >= date('now', ?)
          ORDER BY streak_date ASC`,
    args: [`-${days} days`],
  })
  // 連続日数を計算
  const streak = calcStreak(rows)
  return c.json({ streak, rows })
})

// ─────────────────────────────────────────
// helpers
// ─────────────────────────────────────────

function parseTask(row) {
  if (!row) return null
  return {
    ...row,
    done: row.done === 1,
    wdays: (() => { try { return JSON.parse(row.wdays ?? '[]') } catch { return [] } })(),
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function calcStreak(rows) {
  if (!rows.length) return 0
  const dates = rows.filter(r => r.completed > 0).map(r => r.streak_date).sort()
  if (!dates.length) return 0
  let count = 1
  for (let i = dates.length - 1; i > 0; i--) {
    const prev = new Date(dates[i - 1])
    const cur  = new Date(dates[i])
    const diff = (cur - prev) / 86400000
    if (diff === 1) count++
    else break
  }
  return count
}

// ─────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000)
console.log(`Server running on port ${port}`)
serve({ fetch: app.fetch, port })
