const API = ''  // 本番では 'https://your-app.railway.app' に変更
const RUNIT_JP = {hour:'時間',day:'日',week:'週',month:'ヶ月'}
const WDAYS_JP = ['月','火','水','木','金','土','日']

let tasks = []
let sortMode = 'manual'
let ftype = 'normal'
let dragSrc = null
let completedLog = []
let focusTaskId = null

// ── API ──
async function api(method, path, body) {
  try {
    const res = await fetch(API + path, {
      method,
      headers: {'Content-Type':'application/json'},
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  } catch (e) {
    showErr(e.message)
    throw e
  }
}

async function loadTasks() {
  tasks = await api('GET', '/api/tasks')
  renderList()
  refreshFocus()
}

// ── util ──
function now() {
  const d = new Date()
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}
function pad(n) { return String(n).padStart(2,'0') }
function today() {
  const d = new Date()
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
}
function addMin(t, m) {
  const [h,mn] = t.split(':').map(Number), tot = h*60+mn+m
  return pad(Math.floor(tot/60)%24) + ':' + pad(tot%60)
}
function durToMin(s) { return parseInt(s) || 0 }
function rLabel(t) {
  const w = t.wdays&&t.wdays.length ? '（'+t.wdays.map(d=>WDAYS_JP[d]).join('')+'）' : ''
  return '毎'+t.rnum+RUNIT_JP[t.runit]+w+' '+t.rtime
}
function showErr(msg) {
  const el = document.getElementById('err-toast')
  el.textContent = msg; el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 3000)
}
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

// ── clock & interrupt ──
function tick() {
  const n = now()
  const ce = document.getElementById('clock'); if (ce) ce.textContent = n
  checkInt(n); updateNext(n)
}
function checkInt(n) {
  const u = tasks.find(t => !t.done && t.type==='timed' && t.task_date===today() &&
    n >= addMin(t.end_time, -(t.alert_min||15)) && n <= t.end_time)
  const uel = document.getElementById('int-u')
  if (u) {
    document.getElementById('iu-name').textContent = u.name
    document.getElementById('iu-sub').textContent = '終了：' + u.end_time + 'まで'
    document.getElementById('iu-badge').textContent = tLeft(n,u.end_time) + 'で期限切れ！'
    uel.dataset.tid = u.id; uel.classList.add('active')
  } else uel.classList.remove('active')

  const r = tasks.find(t => !t.done && t.type==='repeat' && n>=t.rtime && n<=addMin(t.rtime,2))
  const rel = document.getElementById('int-r')
  if (r) {
    document.getElementById('ir-name').textContent = r.name
    document.getElementById('ir-sub').textContent = rLabel(r)
    rel.dataset.tid = r.id; rel.classList.add('active')
  } else rel.classList.remove('active')
}
function tLeft(a, b) {
  const [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number),d=bh*60+bm-(ah*60+am)
  return d<=0?'期限切れ':d<60?d+'分':Math.floor(d/60)+'時間'+d%60+'分'
}
function updateNext(n) {
  const el = document.getElementById('f-next'); if (!el) return
  const cs = tasks.filter(t => !t.done && (
    (t.type==='timed'&&t.task_date===today()&&t.end_time>n) ||
    (t.type==='repeat'&&t.rtime>n)
  ))
  if (!cs.length) { el.textContent='次の予定：なし'; return }
  cs.sort((a,b) => (a.type==='timed'?a.end_time:a.rtime) < (b.type==='timed'?b.end_time:b.rtime)?-1:1)
  const nx = cs[0]
  el.textContent = '次の予定：' + (nx.type==='timed'?nx.end_time:nx.rtime) + ' ' + nx.name
}
function doInt(which) {
  const id = parseInt(document.getElementById('int-'+which).dataset.tid||0)
  const t = tasks.find(x => x.id===id)
  if (t) { setFTask(t); dimInt(which); showFocus() }
}
function dimInt(which) { document.getElementById('int-'+which).classList.remove('active') }

// ── focus ──
function normalTasks() { return tasks.filter(t => !t.done && t.type==='normal') }
function setFTask(t) {
  focusTaskId = t.id
  document.getElementById('f-name').textContent = t.name
  const card = document.getElementById('f-card')
  card.className = 'focus-card' + (t.type==='timed'?' is-timed':t.type==='repeat'?' is-repeat':'')
  let rib = card.querySelector('.dl-ribbon'); if (rib) rib.remove()
  if (t.type==='timed') {
    const r = document.createElement('div'); r.className='dl-ribbon'
    r.textContent = '終了 ' + t.end_time + ' まで'; card.prepend(r)
  }
  const pills = document.getElementById('f-pills')
  pills.innerHTML = `<span class="pill p-time">${t.dur}</span><span class="pill p-cat">${t.cat}</span>`
  if (t.type==='timed') pills.innerHTML += `<span class="pill p-dl">期限 ${t.end_time}</span>`
  if (t.type==='repeat') pills.innerHTML += `<span class="pill p-rep">${rLabel(t)}</span>`
  document.getElementById('done-btn').textContent = 'できた！'
  document.getElementById('done-btn').onclick = completeTask
}
function refreshFocus() {
  const d = new Date()
  const days = ['日','月','火','水','木','金','土']
  document.getElementById('f-date').textContent =
    (d.getMonth()+1) + '月' + d.getDate() + '日 ' + days[d.getDay()] + '曜日'

  const normals = normalTasks()
  const doneN = tasks.filter(t => t.done && t.type==='normal').length
  const totalN = tasks.filter(t => t.type==='normal').length
  const pct = totalN>0 ? Math.round(doneN/totalN*100) : 0
  document.getElementById('f-prog').style.width = pct + '%'
  document.getElementById('f-prog-lbl').textContent = doneN + ' / ' + totalN

  if (normals.length === 0) {
    document.getElementById('f-name').textContent = 'きょうのタスクはすべて完了！'
    document.getElementById('f-pills').innerHTML = ''
    document.getElementById('f-card').className = 'focus-card'
    const btn = document.getElementById('done-btn')
    btn.textContent = 'まとめを見る'
    btn.onclick = showDone
    focusTaskId = null
  } else {
    setFTask(normals[0])
  }
}
async function completeTask() {
  if (!focusTaskId) return
  const t = tasks.find(x => x.id===focusTaskId); if (!t) return

  const btn = document.getElementById('done-btn')
  btn.textContent = '✓ できた！'; btn.style.background = 'var(--gr)'

  const ring = document.getElementById('burst')
  ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go')

  const card = document.getElementById('f-card')
  const pop = document.createElement('div')
  pop.className = 'pop'; pop.textContent = 'かんりょう！'
  pop.style.cssText = 'top:64px;left:50%;transform:translateX(-50%)'
  card.appendChild(pop)
  requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add('fly')))

  // API
  await api('PATCH', `/api/tasks/${t.id}`, {done: 1})
  await api('POST', '/api/logs', {task_id:t.id, task_name:t.name, task_type:t.type, dur:t.dur, done:1})

  t.done = true
  completedLog.push({...t})

  // 定期タスクは新しいインスタンスを作成
  if (t.type === 'repeat') {
    const newTask = await api('POST', '/api/tasks', {
      name:t.name, diff:t.diff, cat:t.cat, dur:t.dur, type:'repeat',
      runit:t.runit, rnum:t.rnum, rtime:t.rtime, wdays:t.wdays
    })
    tasks.push(newTask)
  }

  setTimeout(() => {
    pop.remove(); btn.style.background = ''
    refreshFocus(); renderList()
  }, 560)
}
function skipTask() {
  const ns = normalTasks(); if (ns.length < 2) return
  const fi = tasks.findIndex(t => t.id===ns[0].id)
  tasks.push(tasks.splice(fi, 1)[0])
  refreshFocus()
}
function showFocus() { show('sc-f'); refreshFocus() }
function showList() { show('sc-l'); renderList() }
function showCal() { show('sc-c'); renderCalendar() }
async function showDone() {
  const cnt = completedLog.length
  const mins = completedLog.reduce((s,t) => s+durToMin(t.dur), 0)
  document.getElementById('d-cnt').textContent = cnt
  document.getElementById('d-min').textContent = mins

  // ストリーク取得
  try {
    const { streak, rows } = await api('GET', '/api/streaks?days=14')
    document.getElementById('d-streak').textContent = streak
    document.getElementById('d-streak-num').textContent = '🔥 ' + streak + '日れんぞく'
    renderDots(rows, streak)
  } catch {}

  // ログ
  const log = document.getElementById('d-log'); log.innerHTML = ''
  completedLog.forEach(t => {
    const bg = t.type==='timed' ? 'li-timed-bg' : 'li-done-bg'
    const icon = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="${t.type==='timed'?'#D85A30':'#639922'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6.5 5,10 11,3"/></svg>`
    const typetag = t.type==='timed'?'<span style="font-size:10px;background:#FAECE7;color:#712B13;padding:1px 6px;border-radius:999px;">期限あり</span>'
      :t.type==='repeat'?'<span style="font-size:10px;background:#EEEDFE;color:#534AB7;padding:1px 6px;border-radius:999px;">定期</span>':''
    const el = document.createElement('div'); el.className = 'log-item'
    el.innerHTML = `<div class="li-ic ${bg}">${icon}</div><div class="li-body"><div class="li-name">${t.name}</div><div class="li-meta">${t.dur} ${typetag}</div></div><div style="font-size:12px;color:var(--gr-d);">完了</div>`
    log.appendChild(el)
  })
  show('sc-d')
}
function renderDots(rows, streak) {
  const wrap = document.getElementById('d-dots'); wrap.innerHTML = ''
  const days = ['月','火','水','木','金','土','日','月','火','水','木','金','土','日']
  const td = today()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i)
    const ds = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())
    const hit = rows.find(r => r.streak_date===ds)
    const isToday = ds===td
    const cls = isToday?'dot d-today':hit&&hit.completed>0?'dot d-done':'dot d-miss'
    const lbl = isToday?'今':days[d.getDay()===0?6:d.getDay()-1]
    const el = document.createElement('div'); el.className=cls; el.textContent=lbl
    wrap.appendChild(el)
  }
}

// ── list ──
function getSorted() {
  const b = [...tasks]
  if (sortMode==='deadline') return b.sort((a,c) => {
    const ta = a.type==='timed'?a.task_date+'T'+a.end_time:a.type==='repeat'?'9999T'+a.rtime:'9999T99:99'
    const tc = c.type==='timed'?c.task_date+'T'+c.end_time:c.type==='repeat'?'9999T'+c.rtime:'9999T99:99'
    return ta<tc?-1:1
  })
  if (sortMode==='diff') return b.sort((a,c) => ({easy:0,mid:1,hard:2}[a.diff])-({easy:0,mid:1,hard:2}[c.diff]))
  if (sortMode==='time') return b.sort((a,c) => durToMin(a.dur)-durToMin(c.dur))
  if (sortMode==='cat') return b.sort((a,c) => a.cat.localeCompare(c.cat,'ja'))
  return b
}
function setSort(m, btn) {
  sortMode = m
  document.querySelectorAll('.stab').forEach(s => s.classList.remove('on'))
  btn.classList.add('on'); renderList()
}
function renderList() {
  const wrap = document.getElementById('tl'); wrap.innerHTML = ''
  getSorted().forEach(t => {
    const el = document.createElement('div')
    el.className = 'ti' + (t.done?' done-i':'') + (t.type==='timed'?' timed-i':t.type==='repeat'?' repeat-i':'')
    el.dataset.id = t.id; el.draggable = sortMode==='manual'
    const sub = t.type==='timed'?`<span class="tp p-dl2">期限 ${t.end_time}</span>`
      :t.type==='repeat'?`<span class="tp p-rp2">${rLabel(t)}</span>`:''
    el.innerHTML = `
      <div class="dh" style="opacity:${sortMode==='manual'?1:.3}"><span></span><span></span><span></span></div>
      <div class="dd dd-${t.diff[0]}"></div>
      <div class="ti-body">
        <div class="ti-name${t.done?' done':''}">${t.name}</div>
        <div class="ti-meta">
          <span class="tp p-tm">${t.dur}</span>
          <span class="tp p-ct">${t.cat}</span>
          ${sub}
          ${t.done?'<span class="tp p-dn">完了</span>':''}
        </div>
      </div>
      <div class="ti-acts">
        <button class="ab ck${t.done?' on':''}" onclick="toggleDone(${t.id})">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="${t.done?'#639922':'#B4B2A9'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6.5 5,10 11,3"/></svg>
        </button>
        <button class="ab del" onclick="delTask(${t.id})">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#E24B4A" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="3" x2="10" y2="10"/><line x1="10" y1="3" x2="3" y2="10"/></svg>
        </button>
      </div>`
    if (sortMode==='manual') {
      el.addEventListener('dragstart', function(){dragSrc=this;this.classList.add('dragging');})
      el.addEventListener('dragover', function(e){e.preventDefault();if(this!==dragSrc)this.classList.add('drag-over');})
      el.addEventListener('dragleave', function(){this.classList.remove('drag-over');})
      el.addEventListener('drop', async function(e) {
        e.preventDefault(); this.classList.remove('drag-over'); if(this===dragSrc)return
        const fi = tasks.findIndex(x => x.id===parseInt(dragSrc.dataset.id))
        const ti = tasks.findIndex(x => x.id===parseInt(this.dataset.id))
        if(fi<0||ti<0)return
        const [m] = tasks.splice(fi,1); tasks.splice(ti,0,m)
        const ids = tasks.map(t => t.id)
        await api('PATCH', '/api/tasks/reorder', {ids})
        renderList()
      })
      el.addEventListener('dragend', function(){document.querySelectorAll('.ti').forEach(i=>i.classList.remove('dragging','drag-over'));dragSrc=null;})
    }
    wrap.appendChild(el)
  })
}
async function toggleDone(id) {
  const t = tasks.find(x => x.id===id); if (!t) return
  t.done = !t.done
  await api('PATCH', `/api/tasks/${id}`, {done: t.done?1:0})
  renderList(); refreshFocus()
}
async function delTask(id) {
  tasks = tasks.filter(x => x.id!==id)
  await api('DELETE', `/api/tasks/${id}`)
  renderList(); refreshFocus()
}

// ── form ──
function openForm() { document.getElementById('add-form').classList.add('open'); document.getElementById('fn').focus(); setType('normal',document.querySelector('.ttab')) }
function closeForm() { document.getElementById('add-form').classList.remove('open') }
function setType(type, btn) {
  ftype = type
  document.querySelectorAll('.ttab').forEach(t => t.classList.remove('on')); btn.classList.add('on')
  document.getElementById('ef-t').classList.toggle('open', type==='timed')
  document.getElementById('ef-r').classList.toggle('open', type==='repeat')
}
function onRunit() {
  const v = document.getElementById('fr-unit').value
  document.getElementById('fr-lbl').textContent = RUNIT_JP[v]
  document.getElementById('wd-wrap').style.display = v==='week'?'block':'none'
}
async function saveTask() {
  const name = document.getElementById('fn').value.trim(); if (!name) return
  const base = {name, diff:document.getElementById('fd').value, cat:document.getElementById('fc').value, dur:document.getElementById('fdu').value}
  let body
  if (ftype==='timed') {
    body = {...base, type:'timed', task_date:document.getElementById('ft-date').value||today(),
      start_time:document.getElementById('ft-s').value, end_time:document.getElementById('ft-e').value,
      alert_min:parseInt(document.getElementById('ft-al').value)}
  } else if (ftype==='repeat') {
    const wd = [...document.querySelectorAll('.wd.on')].map(d => parseInt(d.dataset.d))
    body = {...base, type:'repeat', runit:document.getElementById('fr-unit').value,
      rnum:parseInt(document.getElementById('fr-n').value)||1, rtime:document.getElementById('fr-t').value, wdays:wd}
  } else {
    body = {...base, type:'normal'}
  }
  const newTask = await api('POST', '/api/tasks', body)
  tasks.push(newTask)
  document.getElementById('fn').value = ''
  closeForm()
  sortMode = 'manual'
  document.querySelectorAll('.stab').forEach((t,i) => t.classList.toggle('on',i===0))
  renderList()
}


// ── CALENDAR ──────────────────────────────
let calView = 'month'
let calYear = new Date().getFullYear()
let calMonth = new Date().getMonth()   // 0-based
let calWeekStart = null  // Date of the week's Monday
let selectedDate = null

function setCalView(v, btn) {
  calView = v
  document.querySelectorAll('.cvtab').forEach(t => t.classList.remove('on'))
  btn.classList.add('on')
  document.getElementById('cal-month-wrap').style.display = v === 'month' ? '' : 'none'
  document.getElementById('cal-week-wrap').style.display = v === 'week' ? '' : 'none'
  document.getElementById('day-panel').style.display = 'none'
  renderCalendar()
}

function calMove(dir) {
  if (calView === 'month') {
    calMonth += dir
    if (calMonth < 0) { calMonth = 11; calYear-- }
    if (calMonth > 11) { calMonth = 0; calYear++ }
  } else {
    const d = new Date(calWeekStart)
    d.setDate(d.getDate() + dir * 7)
    calWeekStart = d
  }
  document.getElementById('day-panel').style.display = 'none'
  renderCalendar()
}

function renderCalendar() {
  updateCalNavTitle()
  if (calView === 'month') renderMonth()
  else renderWeek()
}

function updateCalNavTitle() {
  const el = document.getElementById('cal-nav-title')
  if (calView === 'month') {
    el.textContent = calYear + '年' + (calMonth + 1) + '月'
  } else {
    const ws = getWeekStart()
    const we = new Date(ws); we.setDate(we.getDate() + 6)
    el.textContent = ws.getMonth() === we.getMonth()
      ? (ws.getMonth()+1) + '月' + ws.getDate() + '日〜' + we.getDate() + '日'
      : (ws.getMonth()+1) + '月' + ws.getDate() + '日〜' + (we.getMonth()+1) + '月' + we.getDate() + '日'
  }
}

function getWeekStart() {
  if (!calWeekStart) {
    const d = new Date()
    const day = d.getDay()            // 0=Sun
    const diff = day === 0 ? -6 : 1 - day  // back to Monday
    d.setDate(d.getDate() + diff)
    d.setHours(0,0,0,0)
    calWeekStart = d
  }
  return calWeekStart
}

// タスクをその日に表示すべきか判定
function taskOnDate(t, ds) {
  // ds: 'YYYY-MM-DD'
  if (t.type === 'timed') return t.task_date === ds
  if (t.type === 'repeat') return isRepeatOnDate(t, ds)
  // normal: 今日以降ずっと（完了していなければ当日から）
  return ds === today()
}

function isRepeatOnDate(t, ds) {
  const d = new Date(ds + 'T00:00:00')
  const rtime = t.rtime || '00:00'
  if (t.runit === 'day') return true
  if (t.runit === 'hour') return true
  if (t.runit === 'week') {
    // 曜日チェック（0=月〜6=日）
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1  // 月=0
    if (!t.wdays || !t.wdays.length) return true
    return t.wdays.includes(dow)
  }
  if (t.runit === 'month') {
    // 作成日と同じ日付
    if (!t.created_at) return false
    const created = new Date(t.created_at)
    return d.getDate() === created.getDate()
  }
  return false
}

// 月表示
function renderMonth() {
  const wrap = document.getElementById('cal-cells')
  wrap.innerHTML = ''
  const firstDay = new Date(calYear, calMonth, 1).getDay()   // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const prevDays = new Date(calYear, calMonth, 0).getDate()
  const td = today()

  // 前月の埋め
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevDays - i
    const ds = fmtDate(new Date(calYear, calMonth - 1, day))
    wrap.appendChild(makeCell(ds, day, true))
  }
  // 今月
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = fmtDate(new Date(calYear, calMonth, d))
    wrap.appendChild(makeCell(ds, d, false))
  }
  // 翌月の埋め
  const total = firstDay + daysInMonth
  const remain = total % 7 === 0 ? 0 : 7 - (total % 7)
  for (let d = 1; d <= remain; d++) {
    const ds = fmtDate(new Date(calYear, calMonth + 1, d))
    wrap.appendChild(makeCell(ds, d, true))
  }
}

function makeCell(ds, dayNum, otherMonth) {
  const cell = document.createElement('div')
  const dow = new Date(ds + 'T00:00:00').getDay()
  const isWeekend = dow === 0 || dow === 6
  const td = today()
  cell.className = 'cal-cell' +
    (otherMonth ? ' other-month' : '') +
    (ds === td ? ' today' : '') +
    (isWeekend ? ' weekend-cell' : '') +
    (selectedDate === ds ? ' selected' : '')

  // 日付数字
  const numEl = document.createElement('div')
  numEl.className = 'cal-day-num'
  numEl.textContent = dayNum
  cell.appendChild(numEl)

  // タスクのドット
  const dotRow = document.createElement('div')
  dotRow.className = 'cal-dot-row'
  const dayTasks = tasks.filter(t => taskOnDate(t, ds))
  const shown = dayTasks.slice(0, 5)
  shown.forEach(t => {
    const dot = document.createElement('div')
    dot.className = 'cal-dot ' + (t.done ? 'cal-dot-d' : t.type==='timed' ? 'cal-dot-t' : t.type==='repeat' ? 'cal-dot-r' : 'cal-dot-n')
    dotRow.appendChild(dot)
  })
  cell.appendChild(dotRow)
  if (dayTasks.length > 5) {
    const more = document.createElement('div')
    more.className = 'cal-more'
    more.textContent = '+' + (dayTasks.length - 5)
    cell.appendChild(more)
  }

  cell.addEventListener('click', () => showDayPanel(ds))
  return cell
}

// 週表示
function renderWeek() {
  const ws = getWeekStart()
  const hWrap = document.getElementById('week-header')
  const bWrap = document.getElementById('week-body')
  hWrap.innerHTML = ''; bWrap.innerHTML = ''
  const td = today()

  // header: 時間列ラベル + 7日
  const timeHd = document.createElement('div')
  timeHd.className = 'week-hd-time'
  hWrap.appendChild(timeHd)

  for (let i = 0; i < 7; i++) {
    const d = new Date(ws); d.setDate(d.getDate() + i)
    const ds = fmtDate(d)
    const dow = d.getDay()
    const isToday = ds === td
    const isWeekend = dow === 0 || dow === 6
    const dayNames = ['日','月','火','水','木','金','土']
    const hd = document.createElement('div')
    hd.className = 'week-hd-day' + (isToday?' today-col':'') + (isWeekend?' weekend-col':'')
    const numEl = document.createElement('span')
    numEl.className = 'week-hd-num' + (isToday?' today-num':'')
    numEl.textContent = d.getDate()
    hd.appendChild(numEl)
    hd.appendChild(document.createTextNode(dayNames[dow]))
    hd.addEventListener('click', () => showDayPanel(ds))
    hWrap.appendChild(hd)
  }

  // body: 時間列 + 7日の列
  const timeCol = document.createElement('div')
  timeCol.className = 'week-time-col'
  for (let h = 0; h < 24; h++) {
    const slot = document.createElement('div')
    slot.className = 'week-time-slot'
    slot.textContent = pad(h) + ':00'
    timeCol.appendChild(slot)
  }
  bWrap.appendChild(timeCol)

  for (let i = 0; i < 7; i++) {
    const d = new Date(ws); d.setDate(d.getDate() + i)
    const ds = fmtDate(d)
    const col = document.createElement('div')
    col.className = 'week-day-col'

    // 24 time slots (背景)
    for (let h = 0; h < 24; h++) {
      const s = document.createElement('div')
      s.className = 'week-slot'
      col.appendChild(s)
    }

    // timed tasks をイベントブロックとして配置
    const timedTasks = tasks.filter(t => t.type==='timed' && t.task_date===ds)
    timedTasks.forEach(t => {
      const [sh,sm] = (t.start_time||'09:00').split(':').map(Number)
      const [eh,em] = (t.end_time||'10:00').split(':').map(Number)
      const top = (sh * 60 + sm) / 60 * 40
      const height = Math.max(((eh*60+em)-(sh*60+sm))/60*40, 20)
      const ev = document.createElement('div')
      ev.className = 'week-event we-timed' + (t.done?' we-done':'')
      ev.textContent = t.name
      ev.style.cssText = `top:${top}px;height:${height}px;`
      ev.addEventListener('click', e => { e.stopPropagation(); showDayPanel(ds) })
      col.appendChild(ev)
    })

    // repeat tasks: rtime を使って表示
    const repeatTasks = tasks.filter(t => t.type==='repeat' && isRepeatOnDate(t, ds))
    repeatTasks.forEach((t,idx) => {
      const [rh,rm] = (t.rtime||'08:00').split(':').map(Number)
      const top = (rh * 60 + rm) / 60 * 40
      const ev = document.createElement('div')
      ev.className = 'week-event we-repeat' + (t.done?' we-done':'')
      ev.textContent = t.name
      ev.style.cssText = `top:${top}px;height:20px;left:${2 + idx*2}px;`
      ev.addEventListener('click', e => { e.stopPropagation(); showDayPanel(ds) })
      col.appendChild(ev)
    })

    bWrap.appendChild(col)
  }

  // 現在時刻スクロール
  const now = new Date()
  const scrollTop = (now.getHours() * 60 + now.getMinutes()) / 60 * 40 - 80
  setTimeout(() => { bWrap.scrollTop = Math.max(0, scrollTop) }, 50)
}

// 日別詳細パネル
function showDayPanel(ds) {
  selectedDate = ds
  renderCalendar()   // セル再描画でselectedを反映
  const d = new Date(ds + 'T00:00:00')
  const days = ['日','月','火','水','木','金','土']
  document.getElementById('dp-title').textContent =
    (d.getMonth()+1) + '月' + d.getDate() + '日（' + days[d.getDay()] + '）'

  const dayTasks = tasks.filter(t => taskOnDate(t, ds))
  const items = document.getElementById('dp-items')
  items.innerHTML = ''
  if (!dayTasks.length) {
    items.innerHTML = '<div class="dp-empty">この日のタスクはありません</div>'
  } else {
    dayTasks.forEach(t => {
      const el = document.createElement('div')
      el.className = 'dp-item' + (t.done?' dp-done':'')
      const colorCls = t.done?'dp-c-n':t.type==='timed'?'dp-c-t':t.type==='repeat'?'dp-c-r':'dp-c-n'
      const timeStr = t.type==='timed'?t.start_time+'〜'+t.end_time:t.type==='repeat'?t.rtime:''
      const statusCls = t.done?'dp-s-done':t.type==='timed'&&ds<today()?'dp-s-dead':'dp-s-pend'
      const statusTxt = t.done?'完了':t.type==='timed'&&ds<today()?'期限切れ':'未完了'
      el.innerHTML = `
        <div class="dp-color ${colorCls}"></div>
        <div class="dp-info">
          <div class="dp-name">${t.name}</div>
          <div class="dp-meta">${t.dur}${timeStr?' · '+timeStr:''} · ${t.cat}</div>
        </div>
        <span class="dp-status ${statusCls}">${statusTxt}</span>`
      items.appendChild(el)
    })
  }
  document.getElementById('day-panel').style.display = 'block'
}

function fmtDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
}

// ── init ──
tick()
setInterval(tick, 10000)
loadTasks()
