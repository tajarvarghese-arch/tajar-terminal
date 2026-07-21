import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/command-center.css'

/* ============================================================
   SEED DATA — pulled live from the connected brokerage account.
   qty is signed (negative = short). prevClose lets us compute the
   day move client-side. The scheduled agent refreshes these values;
   /api/quote overwrites `last` with live Yahoo quotes between refreshes.
   ============================================================ */
const seedBook = [
  { sym: 'AAPL', name: 'APPLE',            yh: 'AAPL', qty: -1500,  avg: 160.7906,    last: 327.980011,  prevClose: 326.590000 },
  { sym: 'BSX',  name: 'BOSTON SCIENTIFIC',yh: 'BSX',  qty: 3416,   avg: 73.175,      last: 43.159999,   prevClose: 43.769999 },
  { sym: 'CAT',  name: 'CATERPILLAR',      yh: 'CAT',  qty: -240,   avg: 981.504458,  last: 894.005005,  prevClose: 864.300000 },
  { sym: 'COST', name: 'COSTCO',           yh: 'COST', qty: -510,   avg: 948.973608,  last: 927.674988,  prevClose: 935.800000 },
  { sym: 'CRWV', name: 'COREWEAVE',        yh: 'CRWV', qty: -3000,  avg: 116.902587,  last: 79.894997,   prevClose: 73.060000 },
  { sym: 'FISV', name: 'FISERV',           yh: 'FI',   qty: 1543,   avg: 64.803733,   last: 50.750000,   prevClose: 51.680000 },
  { sym: 'GOOG', name: 'ALPHABET',         yh: 'GOOG', qty: -3000,  avg: 346.462531,  last: 348.390015,  prevClose: 351.370000 },
  { sym: 'MDT',  name: 'MEDTRONIC',        yh: 'MDT',  qty: 13000,  avg: 76.661717,   last: 82.370003,   prevClose: 83.290000 },
  { sym: 'MU',   name: 'MICRON',           yh: 'MU',   qty: -150,   avg: 1133.327467, last: 975.971619,  prevClose: 865.460000 },
  { sym: 'NBIS', name: 'NEBIUS',           yh: 'NBIS', qty: -500,   avg: 276.89748,   last: 214.199997,  prevClose: 182.620000 },
  { sym: 'NFLX', name: 'NETFLIX',          yh: 'NFLX', qty: -10000, avg: 73.222288,   last: 66.860001,   prevClose: 67.600000 },
  { sym: 'OKLO', name: 'OKLO',             yh: 'OKLO', qty: -600,   avg: 174.296667,  last: 43.910000,   prevClose: 41.510000 },
  { sym: 'PLSE', name: 'PULSE BIOSCIENCES',yh: 'PLSE', qty: 1488,   avg: 17.75,       last: 30.620001,   prevClose: 28.960000 },
  { sym: 'SBUX', name: 'STARBUCKS',        yh: 'SBUX', qty: -1200,  avg: 114.746808,  last: 104.739998,  prevClose: 104.810000 },
  { sym: 'SNDK', name: 'SANDISK',          yh: 'SNDK', qty: -62,    avg: 2275.808871, last: 1574.310059, prevClose: 1390.950000 },
  { sym: 'UNH',  name: 'UNITEDHEALTH',     yh: 'UNH',  qty: 15834,  avg: 294.204548,  last: 434.989990,  prevClose: 421.550000 },
]

const cashValue = 5074524.17
const netLiqSeed = 9672143.19

/* Schedule from the connected Google Calendar (today). Agent refreshes daily. */
const seedSchedule = [
  { start: '10:15', end: '11:15', title: 'Piano Lesson', note: 'w/ Candida Borges · protect 15 min warm-up' },
]

const seedNews = [
  { src: 'UNH',  title: 'UnitedHealth — position marked; monitor MLR commentary into next print', time: '', url: 'https://finance.yahoo.com/quote/UNH' },
  { src: 'MKT',  title: 'Live headlines load from your holdings once deployed (Yahoo feed via /api/news)', time: '', url: 'https://finance.yahoo.com' },
]

const seedTodos = [
  { id: 1, text: 'Write three Elova threshold questions', tag: 'QSBS · WED', pri: true, done: false },
  { id: 2, text: 'Review latest Field PULSE / VCAS signals', tag: 'FIELD MED · THU', pri: true, done: false },
  { id: 3, text: 'Gut-check NFLX short into earnings', tag: 'BOOK', pri: false, done: false },
  { id: 4, text: 'Three 10-minute Hogan sessions', tag: 'CRAFT · 0/3', pri: false, done: false },
]

const TODO_KEY = 'hogan-terminal-todos'
const symbolsParam = seedBook.map((p) => p.yh).join(',')

/* ---------- number formatting ---------- */
const usd = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
const usdSign = (n) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
const px = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted')

function loadTodos() {
  try {
    const saved = localStorage.getItem(TODO_KEY)
    return saved ? JSON.parse(saved) : seedTodos
  } catch {
    return seedTodos
  }
}

/* US equity regular session: 09:30–16:00 ET, Mon–Fri (holidays not modeled). */
function marketState(now) {
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const wd = et.find((p) => p.type === 'weekday').value
  const hh = +et.find((p) => p.type === 'hour').value
  const mm = +et.find((p) => p.type === 'minute').value
  const mins = hh * 60 + mm
  const weekday = !['Sat', 'Sun'].includes(wd)
  const open = weekday && mins >= 570 && mins < 960
  return { open, label: open ? 'MKT OPEN' : weekday ? (mins < 570 ? 'PRE-MKT' : 'AFT-MKT') : 'MKT CLOSED' }
}

export default function CommandCenter({ onOpenHogan }) {
  const [book, setBook] = useState(seedBook)
  const [flash, setFlash] = useState({})          // sym -> 'fu' | 'fd'
  const [live, setLive] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [sort, setSort] = useState({ key: 'dayPnl', dir: -1 })
  const [news, setNews] = useState(seedNews)
  const [todos, setTodos] = useState(loadTodos)
  const [draft, setDraft] = useState('')
  const prevPx = useRef(Object.fromEntries(seedBook.map((p) => [p.sym, p.last])))

  /* clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  /* persist todos */
  useEffect(() => {
    try { localStorage.setItem(TODO_KEY, JSON.stringify(todos)) } catch { /* ignore */ }
  }, [todos])

  /* live quotes — Vercel serverless proxy to Yahoo (no key). Falls back to seed. */
  useEffect(() => {
    let alive = true
    async function pull() {
      try {
        const res = await fetch(`/api/quote?symbols=${symbolsParam}`)
        if (!res.ok) throw new Error('no api')
        const data = await res.json()
        if (!alive || !data?.quotes) return
        const nextFlash = {}
        setBook((cur) =>
          cur.map((p) => {
            const q = data.quotes[p.yh]
            if (!q || typeof q.price !== 'number') return p
            const before = prevPx.current[p.sym]
            if (q.price > before) nextFlash[p.sym] = 'fu'
            else if (q.price < before) nextFlash[p.sym] = 'fd'
            prevPx.current[p.sym] = q.price
            return {
              ...p,
              last: q.price,
              prevClose: typeof q.prevClose === 'number' ? q.prevClose : p.prevClose,
            }
          })
        )
        setFlash(nextFlash)
        setLive(true)
        setLastSync(new Date())
      } catch {
        if (alive) setLive(false)
      }
    }
    pull()
    const id = setInterval(pull, 12000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  /* clear flash classes shortly after they mount */
  useEffect(() => {
    if (!Object.keys(flash).length) return
    const t = setTimeout(() => setFlash({}), 950)
    return () => clearTimeout(t)
  }, [flash])

  /* live news — same proxy pattern, refreshed every 5 min */
  useEffect(() => {
    let alive = true
    async function pull() {
      try {
        const res = await fetch(`/api/news?symbols=${symbolsParam}`)
        if (!res.ok) throw new Error('no api')
        const data = await res.json()
        if (alive && Array.isArray(data?.items) && data.items.length) setNews(data.items.slice(0, 14))
      } catch { /* keep seed */ }
    }
    pull()
    const id = setInterval(pull, 300000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  /* derived book rows with day + open P&L */
  const rows = useMemo(() => {
    return book.map((p) => {
      const chgAbs = p.last - p.prevClose
      const chgPct = p.prevClose ? (chgAbs / p.prevClose) * 100 : 0
      const dayPnl = p.qty * chgAbs
      const mv = p.qty * p.last
      const openPnl = p.qty * (p.last - p.avg)
      return { ...p, chgPct, dayPnl, mv, openPnl, side: p.qty >= 0 ? 'long' : 'short' }
    })
  }, [book])

  const totals = useMemo(() => {
    const dayPnl = rows.reduce((s, r) => s + r.dayPnl, 0)
    const openPnl = rows.reduce((s, r) => s + r.openPnl, 0)
    const gross = rows.reduce((s, r) => s + Math.abs(r.mv), 0)
    const netLiq = netLiqSeed + (rows.reduce((s, r) => s + r.last * r.qty, 0) - seedBook.reduce((s, r) => s + r.last * r.qty, 0))
    const dayPct = (dayPnl / (netLiq - dayPnl)) * 100
    return { dayPnl, openPnl, gross, netLiq, dayPct }
  }, [rows])

  const sortedRows = useMemo(() => {
    const r = [...rows]
    r.sort((a, b) => {
      const av = sort.key === 'sym' ? a.sym : a[sort.key]
      const bv = sort.key === 'sym' ? b.sym : b[sort.key]
      if (av < bv) return -1 * sort.dir
      if (av > bv) return 1 * sort.dir
      return 0
    })
    return r
  }, [rows, sort])

  const setSortKey = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'sym' ? 1 : -1 }))

  const mkt = marketState(now)
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now)
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
  }).format(now).toUpperCase()
  const nowHM = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)

  const syncAgo = lastSync ? Math.max(0, Math.round((now - lastSync) / 1000)) : null

  /* todos */
  const addTodo = () => {
    const text = draft.trim()
    if (!text) return
    setTodos((t) => [{ id: Date.now(), text, tag: '', pri: false, done: false }, ...t])
    setDraft('')
  }
  const toggleTodo = (id) => setTodos((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
  const delTodo = (id) => setTodos((t) => t.filter((x) => x.id !== id))
  const clearDone = () => setTodos((t) => t.filter((x) => !x.done))
  const openCount = todos.filter((t) => !t.done).length

  const th = (key, label) => (
    <th className={sort.key === key ? 'sorted' : ''} onClick={() => setSortKey(key)}>
      {label}{sort.key === key && <span className="car"> {sort.dir < 0 ? '▼' : '▲'}</span>}
    </th>
  )

  return (
    <div className="term">
      {/* ---------- TOP BAR ---------- */}
      <header className="term-bar">
        <div className="bar-brand">
          <b>HOGAN&nbsp;TERMINAL</b>
          <span>TAJAR OS</span>
        </div>
        <div className="bar-stats">
          <div className="bar-stat">
            <u>NET LIQ</u>
            <b>{usd(totals.netLiq)}</b>
          </div>
          <div className="bar-stat">
            <u>DAY P&amp;L</u>
            <b className={cls(totals.dayPnl)}>{usdSign(totals.dayPnl)}</b>
          </div>
          <div className="bar-stat">
            <u>DAY %</u>
            <b className={cls(totals.dayPct)}>{pct(totals.dayPct)}</b>
          </div>
          <div className="bar-stat">
            <u>OPEN P&amp;L</u>
            <b className={cls(totals.openPnl)}>{usdSign(totals.openPnl)}</b>
          </div>
        </div>
        <div className="bar-clock">
          <time>{clock}<span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1 }}> ET</span></time>
          <span className={`mkt ${mkt.open ? 'open' : 'closed'}`}><i className="dot" />{mkt.label}</span>
        </div>
      </header>

      {/* ---------- MARQUEE TAPE ---------- */}
      <div className="tape" aria-hidden="true">
        <div className="tape-track">
          {[...rows, ...rows].map((r, i) => (
            <span className="tape-item" key={`${r.sym}-${i}`}>
              <b>{r.sym}</b>
              <span className="px">{px(r.last)}</span>
              <span className={`chg ${r.chgPct >= 0 ? 'up' : 'down'}`}>{pct(r.chgPct)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="term-grid">
        {/* ---------- PORTFOLIO ---------- */}
        <section className="panel span-2">
          <div className="panel-head">
            <h2>PORTFOLIO · POSITIONS</h2>
            <span className="meta">
              {rows.length} POS · GROSS <b>{usd(totals.gross)}</b> · CASH <b>{usd(cashValue)}</b>
            </span>
          </div>
          <div className="pf-summary">
            <div><u>NET LIQ</u><b>{usd(totals.netLiq)}</b></div>
            <div><u>DAY P&amp;L</u><b className={cls(totals.dayPnl)}>{usdSign(totals.dayPnl)}</b></div>
            <div><u>OPEN P&amp;L</u><b className={cls(totals.openPnl)}>{usdSign(totals.openPnl)}</b></div>
            <div><u>GROSS EXP</u><b>{usd(totals.gross)}</b></div>
          </div>
          <div className="pf-table">
            <table className="book">
              <thead>
                <tr>
                  {th('sym', 'SYMBOL')}
                  {th('last', 'LAST')}
                  {th('chgPct', 'CHG%')}
                  {th('dayPnl', 'DAY P&L')}
                  {th('openPnl', 'OPEN P&L')}
                  {th('mv', 'MKT VAL')}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.sym}>
                    <td className="sym">
                      <b>{r.sym}</b>
                      <span className={`ls ${r.side}`}>{r.side === 'long' ? 'L' : 'S'} {Math.abs(r.qty).toLocaleString()}</span>
                      <small>{r.name}</small>
                    </td>
                    <td className={flash[r.sym] || ''}>{px(r.last)}</td>
                    <td className={cls(r.chgPct)}>{pct(r.chgPct)}</td>
                    <td className={cls(r.dayPnl)}>{usdSign(r.dayPnl)}</td>
                    <td className={cls(r.openPnl)}>{usdSign(r.openPnl)}</td>
                    <td className="muted">{usd(r.mv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- NEWS ---------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>TAPE · HOLDINGS NEWS</h2>
            <span className="meta">{live ? 'LIVE' : 'SEED'}</span>
          </div>
          <div className="news-list">
            {news.map((n, i) => (
              <a className="news-row" key={`${n.title}-${i}`} href={n.url} target="_blank" rel="noreferrer">
                <div>
                  <div className="nsrc">{n.src}</div>
                  {n.time && <div className="ntime">{n.time}</div>}
                </div>
                <div>
                  <h3>{n.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ---------- SCHEDULE ---------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>TODAY · {dateStr}</h2>
            <span className="meta">{seedSchedule.length} {seedSchedule.length === 1 ? 'EVENT' : 'EVENTS'}</span>
          </div>
          <div className="agenda">
            {seedSchedule.length === 0 && <div className="agenda-empty">No commitments. Clear board.</div>}
            {seedSchedule.map((e, i) => {
              const active = nowHM >= e.start && nowHM < e.end
              return (
                <div className="agenda-row" key={i}>
                  <div className="agenda-time">{e.start}<small>{e.end}</small></div>
                  <div className="agenda-body">
                    <h3>{e.title}</h3>
                    {e.note && <p>{e.note}</p>}
                    {active && <span className="now">● NOW</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------- TODO ---------- */}
        <section className="panel span-2">
          <div className="panel-head">
            <h2>EXECUTION · TODO</h2>
            <span className="meta"><b>{openCount}</b> OPEN · {todos.length - openCount} DONE</span>
          </div>
          <div className="todo-add">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              placeholder="ADD TASK — PRESS ENTER"
            />
            <button onClick={addTodo}>+ ADD</button>
          </div>
          <div className="todo-list">
            {todos.map((t) => (
              <button className={`todo-item ${t.done ? 'done' : ''} ${t.pri ? 'pri' : ''}`} key={t.id} onClick={() => toggleTodo(t.id)}>
                <span className="todo-box">{t.done ? '✓' : ''}</span>
                <span className="txt">{t.text}</span>
                {t.tag && <span className="tag">{t.pri ? '★ ' : ''}{t.tag}</span>}
                <span className="todo-del" onClick={(e) => { e.stopPropagation(); delTodo(t.id) }} aria-label="delete">✕</span>
              </button>
            ))}
          </div>
          <div className="todo-foot">
            <span>TAP TO TOGGLE · ✕ TO REMOVE</span>
            <button onClick={clearDone}>CLEAR DONE</button>
          </div>
        </section>
      </div>

      {/* ---------- FOOTER ---------- */}
      <footer className="term-foot">
        <span className="data-note">
          POSITIONS FROM CONNECTED BROKERAGE · QUOTES {live ? 'LIVE (YAHOO)' : 'SNAPSHOT'}
          {syncAgo != null && ` · SYNC ${syncAgo}s AGO`}
        </span>
        <button onClick={onOpenHogan}>OPEN HOGAN COACH ↗</button>
      </footer>
    </div>
  )
}
