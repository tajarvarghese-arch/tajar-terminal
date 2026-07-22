import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/command-center.css'

/* ============================================================
   TAJAR TERMINAL — a life terminal in a brutalist Bloomberg skin.
   TODAY -> WEEK -> HORIZON -> STREAKS -> LOG -> GROUNDING -> MARKETS.
   Personal state: localStorage cache + private cloud store (/api/state).
   Calendar/position seeds are stamped with their sync date and the UI
   refuses to present them as current once that date has passed.
   ============================================================ */

/* ---------- PORTFOLIO SEED (demoted to a strip) ---------- */
/* Positions pulled from the connected brokerage; live quotes via /api/quote. */
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
const netLiqSeed = 9672143.19
const symbolsParam = seedBook.map((p) => p.yh).join(',')

/* ---------- storage keys ---------- */
const K = {
  sober: 'tajar-sober-start',
  focus: 'tajar-focus',
  todos: 'tajar-today-todos',
  horizon: 'tajar-horizon',
  reasons: 'tajar-reasons',
  mkt: 'tajar-markets-open',
  streaks: 'tajar-streaks',
  log: 'tajar-captains-log',
  syncKey: 'tajar-sync-key',
  updated: 'tajar-updated-at',
}

const DEFAULT_SOBER = '2025-10-09'

/* ---------- weather (Open-Meteo, no key, CORS-open) ---------- */
const WX_LAT = 41.0262   // Greenwich, CT
const WX_LON = -73.6282
const WX_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${WX_LAT}&longitude=${WX_LON}` +
  `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
  `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,weather_code` +
  `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=5`

/* NOAA tide predictions — Cos Cob Harbor, Greenwich CT (no key, CORS-open) */
const TIDE_STATION = '8469549'
const tideURL = (from, to) =>
  `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW` +
  `&station=${TIDE_STATION}&time_zone=lst_ldt&units=english&interval=hilo&format=json` +
  `&begin_date=${from}&end_date=${to}`

/* WMO weather codes -> terse terminal labels */
const WMO = [
  [0, 'CLEAR'], [1, 'MOSTLY CLEAR'], [2, 'PARTLY CLOUDY'], [3, 'OVERCAST'],
  [48, 'FOG'], [55, 'DRIZZLE'], [57, 'FRZ DRIZZLE'], [65, 'RAIN'], [67, 'FRZ RAIN'],
  [77, 'SNOW'], [82, 'SHOWERS'], [86, 'SNOW SHOWERS'], [99, 'T-STORM'],
]
const wmoLabel = (code) => (WMO.find(([max]) => code <= max) || [0, '—'])[1]

/* minimal monochrome weather glyphs — amber sun, dim cloud/precip */
function WxIcon({ code, size = 22 }) {
  const amber = '#ffab00'
  const dim = '#7d7565'
  const s = { width: size, height: size, display: 'block' }
  const sun = (
    <g stroke={amber} strokeWidth="1.6" fill="none">
      <circle cx="12" cy="12" r="4.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180
        return <line key={a} x1={12 + Math.cos(r) * 6.5} y1={12 + Math.sin(r) * 6.5} x2={12 + Math.cos(r) * 8.8} y2={12 + Math.sin(r) * 8.8} />
      })}
    </g>
  )
  const cloud = (dx = 0, dy = 0) => (
    <path
      d={`M ${6 + dx} ${15 + dy} a 3.4 3.4 0 0 1 .4 -6.8 a 4.6 4.6 0 0 1 8.8 -1 a 3.6 3.6 0 0 1 1.4 7.8 z`}
      stroke={dim} strokeWidth="1.6" fill="none" strokeLinejoin="round"
    />
  )
  let body
  if (code <= 1) body = sun
  else if (code === 2) body = (<>
    <g transform="translate(3.5,-2.5) scale(0.62)">{sun}</g>
    {cloud(1.5, 4)}
  </>)
  else if (code === 3) body = cloud(1.5, 3)
  else if (code <= 48) body = (
    <g stroke={dim} strokeWidth="1.6"><line x1="4" y1="9" x2="20" y2="9" /><line x1="6" y1="13" x2="18" y2="13" /><line x1="4" y1="17" x2="20" y2="17" /></g>
  )
  else if (code <= 67 || (code >= 80 && code <= 82)) body = (<>
    {cloud(1.5, 0)}
    <g stroke={amber} strokeWidth="1.5">
      <line x1="8" y1="17.5" x2="6.8" y2="21" /><line x1="12.5" y1="17.5" x2="11.3" y2="21" /><line x1="17" y1="17.5" x2="15.8" y2="21" />
    </g>
  </>)
  else if (code <= 77 || code === 85 || code === 86) body = (<>
    {cloud(1.5, 0)}
    <g fill={dim}><circle cx="8" cy="19" r="1.1" /><circle cx="12.5" cy="20.5" r="1.1" /><circle cx="17" cy="19" r="1.1" /></g>
  </>)
  else body = (<>
    {cloud(1.5, 0)}
    <path d="M 12.5 15.5 L 9.5 20 L 12 20 L 10.5 23.5 L 15 18.5 L 12.5 18.5 L 14.5 15.5 Z" fill={amber} stroke="none" />
  </>)
  return <svg viewBox="0 0 24 24" style={s} aria-hidden="true">{body}</svg>
}

/* Schedule from the connected Google Calendar. SCHEDULE_FOR stamps the
   day it was synced for — past that date the panel says so instead of
   showing another day's events as today's. Agent refreshes both daily. */
const SCHEDULE_FOR = '2026-07-22'
const seedSchedule = [
  { start: '07:00', end: '08:00', title: 'GMG meeting', note: 'double-booked w/ mazurka sight-reading' },
  { start: '08:00', end: '09:00', title: 'Encon maintenance' },
  { start: '14:30', end: '15:30', title: 'QSBS gut-check · Citrin Cooperman', note: 'Teams · Brett Franks + Piyush' },
]

/* Week ahead — each row carries its real date so stale days drop off. */
const seedWeek = [
  { iso: '2026-07-23', day: 'THU', date: '23', items: [
    { t: '07:00', s: 'Sight-read mazurka ×2' },
  ]},
  { iso: '2026-07-24', day: 'FRI', date: '24', items: [
    { t: '07:00', s: 'Sight-read mazurka ×2' },
  ]},
  { iso: '2026-07-25', day: 'SAT', date: '25', items: [
    { t: '07:00', s: 'Sight-read mazurka ×2' },
    { t: '14:00', s: 'The Odyssey — IMAX · Port Chester' },
  ]},
  { iso: '2026-07-26', day: 'SUN', date: '26', items: [
    { t: '07:00', s: 'Sight-read mazurka ×2' },
  ]},
  { iso: '2026-07-27', day: 'MON', date: '27', items: [
    { t: '07:00', s: 'Greenwich Central Men’s Meeting' },
    { t: '15:00', s: 'Kevin Trexler + Matt Sirovich', hot: true },
  ]},
  { iso: '2026-07-28', day: 'TUE', date: '28', items: [
    { t: '09:15', s: 'Coffee w/ Tim Coleman · CFCF' },
    { t: '10:15', s: 'Piano Lesson' },
    { t: '14:30', s: 'Ben’s oral surgery consult · Stamford', hot: true },
  ]},
  { iso: '2026-07-29', day: 'WED', date: '29', items: [
    { t: '07:00', s: 'GMG meeting' },
    { t: '17:30', s: 'Dinner · Keens Steakhouse NYC' },
    { t: '18:00', s: 'Phish at MSG · Sec 120 Row 6' },
  ]},
]

/* Streak habits — tap cells to log; add your own in-app. */
const seedStreaks = {
  habits: [
    { id: 'piano', name: 'PIANO' },
    { id: 'golf', name: 'GOLF' },
    { id: 'move', name: 'WORKOUT' },
    { id: 'meeting', name: 'MEETING' },
  ],
  marks: {},
}

const seedTodos = [
  { id: 1, text: 'Set today’s three must-dos', done: false },
]

/* Horizon starts empty — goals and obligations are added in-app. */
const seedHorizon = []

const seedReasons = []

const QUOTES = [
  { t: 'You have power over your mind — not outside events. Realize this, and you will find strength.', by: 'Marcus Aurelius' },
  { t: 'We suffer more often in imagination than in reality.', by: 'Seneca' },
  { t: 'First say to yourself what you would be; then do what you have to do.', by: 'Epictetus' },
  { t: 'What stands in the way becomes the way.', by: 'Marcus Aurelius' },
  { t: 'Discipline is choosing between what you want now and what you want most.', by: '—' },
  { t: 'Fall seven times, stand up eight.', by: 'Japanese proverb' },
  { t: 'The best way out is always through.', by: 'Robert Frost' },
  { t: 'Progress, not perfection.', by: '—' },
  { t: 'Waste no more time arguing what a good man should be. Be one.', by: 'Marcus Aurelius' },
  { t: 'The man who moves a mountain begins by carrying away small stones.', by: 'after Confucius' },
  { t: 'How you do anything is how you do everything.', by: '—' },
  { t: 'Rock bottom became the solid foundation on which I rebuilt my life.', by: 'J.K. Rowling' },
  { t: 'One day at a time. Today is the one.', by: '—' },
  { t: 'He who has a why to live can bear almost any how.', by: 'Nietzsche' },
]

/* ---------- date + number helpers ---------- */
const todayMid = (now) => new Date(now.getFullYear(), now.getMonth(), now.getDate())
const parseMid = (s) => {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''))
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const DAY = 86400000
const daysSince = (startStr, now) => { const d = parseMid(startStr); return d ? Math.max(0, Math.round((todayMid(now) - d) / DAY)) : 0 }
const daysUntil = (dateStr, now) => { const d = parseMid(dateStr); return d ? Math.round((d - todayMid(now)) / DAY) : Infinity }
const dayOfYear = (now) => Math.floor((todayMid(now) - new Date(now.getFullYear(), 0, 0)) / DAY)

const usdShort = (n) => {
  const a = Math.abs(n)
  if (a >= 1e6) return (n < 0 ? '-$' : '$') + (a / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return (n < 0 ? '-$' : '$') + (a / 1e3).toFixed(0) + 'K'
  return (n < 0 ? '-$' : '$') + a.toFixed(0)
}
const px = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted')
const fmtDate = (s) => {
  const d = parseMid(s)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: '2-digit' }).format(d).toUpperCase()
}

/* ---------- goal command-line parser ----------
   One input: goal text optionally ending with a date token —
   "qsbs decision 7/23" · "renew passport aug 15" · "call brett in 10d"
   · "recital fri" · "file taxes 2026-10-15". Returns { label, date|null }. */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
function parseGoal(raw, now) {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (!s) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const iso = (d) => new Intl.DateTimeFormat('en-CA').format(d)
  const rollYear = (d) => (d < today ? new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()) : d)
  const rules = [
    { re: / (\d{4})-(\d{1,2})-(\d{1,2})$/i,
      to: (m) => new Date(+m[1], +m[2] - 1, +m[3]) },
    { re: / (\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/,
      to: (m) => {
        const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : today.getFullYear()
        const d = new Date(y, +m[1] - 1, +m[2])
        return m[3] ? d : rollYear(d)
      } },
    { re: / (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (\d{1,2})$/i,
      to: (m) => rollYear(new Date(today.getFullYear(), MONTHS.indexOf(m[1].toLowerCase()), +m[2])) },
    { re: / (?:in )?(\d{1,3})d$/i,
      to: (m) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + +m[1]) },
    { re: / (tomorrow|tmrw)$/i,
      to: () => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) },
    { re: / today$/i, to: () => today },
    { re: / (sun|mon|tue|wed|thu|fri|sat)[a-z]*$/i,
      to: (m) => {
        const target = WEEKDAYS.indexOf(m[1].toLowerCase())
        const delta = ((target - today.getDay()) + 7) % 7 || 7
        return new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta)
      } },
  ]
  for (const { re, to } of rules) {
    const m = s.match(re)
    if (!m) continue
    const label = s.slice(0, m.index).trim()
    if (!label) continue
    const d = to(m)
    if (Number.isNaN(d?.getTime())) continue
    return { label, date: iso(d) }
  }
  return { label: s, date: null }
}

function load(key, fallback) {
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : fallback
  } catch {
    return fallback
  }
}
function loadStr(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    if (v == null) return fallback
    try { const p = JSON.parse(v); return typeof p === 'string' ? p : v } catch { return v }
  } catch {
    return fallback
  }
}

function marketState(now) {
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const wd = et.find((p) => p.type === 'weekday').value
  const mins = +et.find((p) => p.type === 'hour').value * 60 + +et.find((p) => p.type === 'minute').value
  const weekday = !['Sat', 'Sun'].includes(wd)
  const open = weekday && mins >= 570 && mins < 960
  return { open, label: open ? 'MKT OPEN' : weekday ? (mins < 570 ? 'PRE-MKT' : 'AFT-MKT') : 'MKT CLOSED' }
}

export default function CommandCenter() {
  const [now, setNow] = useState(() => new Date())

  /* portfolio (demoted) */
  const [book, setBook] = useState(seedBook)
  const [live, setLive] = useState(false)
  const [mktOpen, setMktOpen] = useState(() => load(K.mkt, false))

  /* life state */
  const [soberStart, setSoberStart] = useState(() => loadStr(K.sober, DEFAULT_SOBER))
  const [editSober, setEditSober] = useState(false)
  const [focus, setFocus] = useState(() => loadStr(K.focus, ''))
  const [editFocus, setEditFocus] = useState(false)
  const [focusDraft, setFocusDraft] = useState('')
  const [todos, setTodos] = useState(() => load(K.todos, seedTodos))
  const [todoDraft, setTodoDraft] = useState('')
  const [horizon, setHorizon] = useState(() => load(K.horizon, seedHorizon))
  const [hzDraft, setHzDraft] = useState('')
  const [reasons, setReasons] = useState(() => load(K.reasons, seedReasons))
  const [reasonDraft, setReasonDraft] = useState('')
  const [wx, setWx] = useState(null)
  const [tides, setTides] = useState([])
  const [streaks, setStreaks] = useState(() => load(K.streaks, seedStreaks))
  const [habitDraft, setHabitDraft] = useState('')
  const [logEntries, setLogEntries] = useState(() => load(K.log, []))
  const [logDraft, setLogDraft] = useState('')
  const [wire, setWire] = useState([])
  const [vitals, setVitals] = useState(null)
  const [calDays, setCalDays] = useState(null)
  const [calTs, setCalTs] = useState(null)
  const [syncKey, setSyncKey] = useState(() => loadStr(K.syncKey, ''))
  const [syncStatus, setSyncStatus] = useState('off') // off | ok | err
  const [editSync, setEditSync] = useState(false)
  const [syncDraft, setSyncDraft] = useState('')
  const applyingRef = useRef(false)
  const pushTimer = useRef(null)
  const tapeRef = useRef(null)

  /* clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  /* wire tape scroll — rAF-driven so iOS can't drop the animated layer.
     Width is measured live each frame; wraps at the exact halfway point. */
  useEffect(() => {
    let raf
    let offset = 0
    let last = performance.now()
    const SPEED = 42 // px/s
    const step = (t) => {
      const el = tapeRef.current
      if (el) {
        const half = el.scrollWidth / 2
        const dt = Math.min(0.1, (t - last) / 1000) // clamp resume-from-background jumps
        if (half > 0) {
          offset = (offset + SPEED * dt) % half
          el.style.transform = `translate3d(${-offset}px,0,0)`
        }
      }
      last = t
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  /* persistence */
  useEffect(() => { try { localStorage.setItem(K.sober, JSON.stringify(soberStart)) } catch {} }, [soberStart])
  useEffect(() => { try { localStorage.setItem(K.focus, JSON.stringify(focus)) } catch {} }, [focus])
  useEffect(() => { try { localStorage.setItem(K.todos, JSON.stringify(todos)) } catch {} }, [todos])
  useEffect(() => { try { localStorage.setItem(K.horizon, JSON.stringify(horizon)) } catch {} }, [horizon])
  useEffect(() => { try { localStorage.setItem(K.reasons, JSON.stringify(reasons)) } catch {} }, [reasons])
  useEffect(() => { try { localStorage.setItem(K.mkt, JSON.stringify(mktOpen)) } catch {} }, [mktOpen])
  useEffect(() => { try { localStorage.setItem(K.streaks, JSON.stringify(streaks)) } catch {} }, [streaks])
  useEffect(() => { try { localStorage.setItem(K.log, JSON.stringify(logEntries)) } catch {} }, [logEntries])

  /* wire headlines — holdings news via Vercel proxy, refreshed every 5 min */
  useEffect(() => {
    let alive = true
    async function pull() {
      try {
        const res = await fetch(`/api/news?symbols=${symbolsParam}`)
        if (!res.ok) throw new Error('no api')
        const data = await res.json()
        if (alive && Array.isArray(data?.items)) setWire(data.items.slice(0, 10))
      } catch { /* tape falls back to movers + wx */ }
    }
    pull()
    const id = setInterval(pull, 300000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  /* ---------- cloud sync (Upstash via /api/state) ----------
     localStorage stays the offline cache; the server copy survives
     domain changes, re-installs, and new devices. Last write wins. */
  const applyRemote = (d) => {
    /* Suppress the push-back echo with a time window, not a consume-flag:
       if every setter below happens to bail (values identical), a consumed
       flag would swallow the user's NEXT real edit instead. */
    applyingRef.current = true
    setTimeout(() => { applyingRef.current = false }, 100)
    if (d.soberStart) setSoberStart(d.soberStart)
    if (typeof d.focus === 'string') setFocus(d.focus)
    if (Array.isArray(d.todos)) setTodos(d.todos)
    if (Array.isArray(d.horizon)) setHorizon(d.horizon)
    if (Array.isArray(d.reasons)) setReasons(d.reasons)
    if (d.streaks?.habits) setStreaks(d.streaks)
    if (Array.isArray(d.logEntries)) setLogEntries(d.logEntries)
  }

  const snapshot = () => ({
    soberStart, focus, todos, horizon, reasons, streaks, logEntries,
  })

  /* pull once per key change */
  useEffect(() => {
    if (!syncKey) { setSyncStatus('off'); return }
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/state', { headers: { 'x-sync-key': syncKey } })
        if (!alive) return
        if (res.status === 401) { setSyncStatus('err'); return }
        if (!res.ok) { setSyncStatus('err'); return }
        const body = await res.json()
        const localUpdated = Number(loadStr(K.updated, '0')) || 0
        if (body?.data && (body.updatedAt || 0) > localUpdated) {
          applyRemote(body.data)
          try { localStorage.setItem(K.updated, String(body.updatedAt)) } catch {}
        } else {
          // local is newer (or server empty) — seed the server
          await fetch('/api/state', {
            method: 'PUT',
            headers: { 'x-sync-key': syncKey, 'content-type': 'application/json' },
            body: JSON.stringify({ data: snapshot(), updatedAt: localUpdated || Date.now() }),
          })
        }
        setSyncStatus('ok')
      } catch {
        if (alive) setSyncStatus('err')
      }
    })()
    return () => { alive = false }
  }, [syncKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* debounced push on any personal-state change */
  useEffect(() => {
    if (!syncKey) return
    if (applyingRef.current) return
    const updatedAt = Date.now()
    try { localStorage.setItem(K.updated, String(updatedAt)) } catch {}
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'x-sync-key': syncKey, 'content-type': 'application/json' },
          body: JSON.stringify({ data: snapshot(), updatedAt }),
        })
        setSyncStatus(res.ok ? 'ok' : 'err')
      } catch {
        setSyncStatus('err')
      }
    }, 1500)
    return () => clearTimeout(pushTimer.current)
  }, [soberStart, focus, todos, horizon, reasons, streaks, logEntries]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveSyncKey = () => {
    const k = syncDraft.trim()
    setEditSync(false); setSyncDraft('')
    if (!k) return
    try { localStorage.setItem(K.syncKey, JSON.stringify(k)) } catch {}
    setSyncKey(k)
  }

  /* vitals — daily Apple Health stats posted by an iOS Shortcut to /api/health */
  useEffect(() => {
    if (!syncKey) { setVitals(null); return }
    let alive = true
    async function pull() {
      try {
        const res = await fetch('/api/health', { headers: { 'x-sync-key': syncKey } })
        if (!res.ok) throw new Error('no health api')
        const body = await res.json()
        if (alive && body?.days) setVitals(body.days)
      } catch { /* strip simply stays hidden */ }
    }
    pull()
    const id = setInterval(pull, 300000)
    return () => { alive = false; clearInterval(id) }
  }, [syncKey])

  /* live calendar — Google secret iCal feed via /api/calendar.
     Pulled on load, every 15 min, and every time the app returns to the
     foreground — so the schedule is synced whenever the app is opened. */
  useEffect(() => {
    if (!syncKey) { setCalDays(null); return }
    let alive = true
    async function pull() {
      try {
        const res = await fetch('/api/calendar', { headers: { 'x-sync-key': syncKey } })
        if (!res.ok) throw new Error('no calendar api')
        const body = await res.json()
        if (alive && body?.days) { setCalDays(body.days); setCalTs(body.ts) }
      } catch { /* seeds + freshness guard remain the fallback */ }
    }
    pull()
    const id = setInterval(pull, 900000)
    const onVisible = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [syncKey])

  /* tides — NOAA Cos Cob Harbor, refreshed every 6 h (predictions are static) */
  useEffect(() => {
    let alive = true
    async function pull() {
      try {
        const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d).replace(/-/g, '')
        const today = new Date()
        const tomorrow = new Date(today.getTime() + 86400000)
        const res = await fetch(tideURL(fmt(today), fmt(tomorrow)))
        if (!res.ok) throw new Error('tides')
        const d = await res.json()
        if (alive && Array.isArray(d?.predictions)) {
          setTides(d.predictions.map((p) => ({
            when: new Date(p.t.replace(' ', 'T')),
            ft: Number(p.v),
            type: p.type,
          })))
        }
      } catch { /* strip cells simply stay hidden */ }
    }
    pull()
    const id = setInterval(pull, 21600000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  /* next high / low tide relative to now */
  const nextTide = useMemo(() => {
    const upcoming = tides.filter((t) => t.when > now)
    const hm = (d) => new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
    const h = upcoming.find((t) => t.type === 'H')
    const l = upcoming.find((t) => t.type === 'L')
    return {
      high: h ? { at: hm(h.when), ft: h.ft.toFixed(1), tmrw: h.when.getDate() !== now.getDate() } : null,
      low: l ? { at: hm(l.when), ft: l.ft.toFixed(1), tmrw: l.when.getDate() !== now.getDate() } : null,
    }
  }, [tides, now])

  /* weather — Open-Meteo direct from the browser, refreshed every 15 min */
  useEffect(() => {
    let alive = true
    async function pull() {
      try {
        const res = await fetch(WX_URL)
        if (!res.ok) throw new Error('wx')
        const d = await res.json()
        if (!alive || !d?.current) return
        setWx({
          temp: Math.round(d.current.temperature_2m),
          feels: Math.round(d.current.apparent_temperature),
          label: wmoLabel(d.current.weather_code),
          wind: Math.round(d.current.wind_speed_10m),
          hi: Math.round(d.daily.temperature_2m_max[0]),
          lo: Math.round(d.daily.temperature_2m_min[0]),
          precip: d.daily.precipitation_probability_max[0],
          sunrise: (d.daily.sunrise[0] || '').slice(11, 16),
          sunset: (d.daily.sunset[0] || '').slice(11, 16),
          days: (d.daily.time || []).map((t, i) => ({
            date: t,
            code: d.daily.weather_code?.[i] ?? 0,
            hi: Math.round(d.daily.temperature_2m_max[i]),
            lo: Math.round(d.daily.temperature_2m_min[i]),
          })),
        })
      } catch { /* keep last reading */ }
    }
    pull()
    const id = setInterval(pull, 900000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  /* live quotes — Vercel proxy to Yahoo (no key). Falls back to seed snapshot. */
  useEffect(() => {
    let alive = true
    async function pull() {
      try {
        const res = await fetch(`/api/quote?symbols=${symbolsParam}`)
        if (!res.ok) throw new Error('no api')
        const data = await res.json()
        if (!alive || !data?.quotes) return
        setBook((cur) =>
          cur.map((p) => {
            const q = data.quotes[p.yh]
            if (!q || typeof q.price !== 'number') return p
            return { ...p, last: q.price, prevClose: typeof q.prevClose === 'number' ? q.prevClose : p.prevClose }
          })
        )
        setLive(true)
      } catch {
        if (alive) setLive(false)
      }
    }
    pull()
    const id = setInterval(pull, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  /* ---------- derived ---------- */
  const rows = useMemo(() =>
    book.map((p) => {
      const chgAbs = p.last - p.prevClose
      const chgPct = p.prevClose ? (chgAbs / p.prevClose) * 100 : 0
      const dayPnl = p.qty * chgAbs
      return { ...p, chgPct, dayPnl, mv: p.qty * p.last }
    }), [book])

  const mkt = useMemo(() => {
    const dayPnl = rows.reduce((s, r) => s + r.dayPnl, 0)
    const netLiq = netLiqSeed + rows.reduce((s, r) => s + r.last * r.qty, 0) - seedBook.reduce((s, r) => s + r.last * r.qty, 0)
    const dayPct = (dayPnl / (netLiq - dayPnl)) * 100
    const movers = [...rows].sort((a, b) => Math.abs(b.dayPnl) - Math.abs(a.dayPnl)).slice(0, 4)
    return { dayPnl, netLiq, dayPct, movers }
  }, [rows])

  const sober = useMemo(() => ({ days: daysSince(soberStart, now) }), [soberStart, now])

  const horizonSorted = useMemo(() => {
    return [...horizon]
      .map((h) => ({ ...h, t: h.date ? daysUntil(h.date, now) : Infinity }))
      .sort((a, b) => a.t - b.t)
  }, [horizon, now])

  const quote = QUOTES[dayOfYear(now) % QUOTES.length]
  const why = reasons.length ? reasons[dayOfYear(now) % reasons.length] : null

  const marketStatus = marketState(now)
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now)
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: '2-digit',
  }).format(now).toUpperCase()
  const nowHM = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)

  /* ---------- actions ---------- */
  const openFocusEdit = () => { setFocusDraft(focus); setEditFocus(true) }
  const saveFocus = () => { setFocus(focusDraft.trim()); setEditFocus(false) }

  const addTodo = () => {
    const text = todoDraft.trim()
    if (!text) return
    setTodos((t) => [...t, { id: Date.now(), text, done: false }])
    setTodoDraft('')
  }
  const toggleTodo = (id) => setTodos((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
  const delTodo = (id) => setTodos((t) => t.filter((x) => x.id !== id))

  const hzParsed = useMemo(() => parseGoal(hzDraft, now), [hzDraft, now])
  const addHorizon = () => {
    if (!hzParsed) return
    setHorizon((h) => [...h, { id: Date.now(), label: hzParsed.label, date: hzParsed.date, note: '', progress: null }])
    setHzDraft('')
  }
  const delHorizon = (id) => setHorizon((h) => h.filter((x) => x.id !== id))

  const addReason = () => {
    const text = reasonDraft.trim()
    if (!text) return
    setReasons((r) => [...r, text])
    setReasonDraft('')
  }
  const delReason = (i) => setReasons((r) => r.filter((_, idx) => idx !== i))

  /* streaks */
  const isoOf = (d) => new Intl.DateTimeFormat('en-CA').format(d)
  const todayISO = isoOf(now)

  /* calendar freshness — live feed first, date-stamped seeds as fallback,
     and never present a stale sync as current data */
  const liveToday = calDays
    ? (calDays[todayISO] || []).map((i) => ({ start: i.t, end: i.e, title: i.s, note: i.loc, cal: i.cal }))
    : null
  const scheduleFresh = todayISO === SCHEDULE_FOR
  const todaySchedule = liveToday ?? (scheduleFresh ? seedSchedule : [])
  const calOK = liveToday != null || scheduleFresh

  const weekRows = useMemo(() => {
    if (!calDays) return seedWeek.filter((d) => d.iso > todayISO)
    return [...Array(7)].map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + i)
      const iso = isoOf(d)
      return {
        iso,
        day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d).toUpperCase(),
        date: String(d.getDate()),
        items: (calDays[iso] || []).map((it) => ({ t: it.t, s: it.s, cal: it.cal })),
      }
    }).filter((r) => r.items.length)
  }, [calDays, todayISO]) // eslint-disable-line react-hooks/exhaustive-deps

  const mdShort = (iso) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(parseMid(iso)).toUpperCase()
  const hmOf = (ts) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))
  const weekMeta = calDays
    ? `LIVE · SYNCED ${hmOf(calTs)}`
    : weekRows.length
      ? `${mdShort(weekRows[0].iso)} – ${mdShort(weekRows[weekRows.length - 1].iso)} · SYNCED`
      : 'AWAITING SYNC'
  const last28 = useMemo(() => {
    return [...Array(28)].map((_, i) => isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27 + i)))
  }, [todayISO]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggleMark = (habitId, iso) => {
    setStreaks((s) => {
      const cur = new Set(s.marks[habitId] || [])
      cur.has(iso) ? cur.delete(iso) : cur.add(iso)
      return { ...s, marks: { ...s.marks, [habitId]: [...cur] } }
    })
  }
  const streakCount = (habitId) => {
    const marked = new Set(streaks.marks[habitId] || [])
    let count = 0
    // streak = consecutive marked days ending today (or yesterday if today not yet logged)
    let cursor = marked.has(todayISO) ? 0 : 1
    for (;;) {
      const iso = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - cursor))
      if (!marked.has(iso)) break
      count++; cursor++
    }
    return count
  }
  const addHabit = () => {
    const name = habitDraft.trim().toUpperCase()
    if (!name) return
    setStreaks((s) => ({ ...s, habits: [...s.habits, { id: `h${Date.now()}`, name }] }))
    setHabitDraft('')
  }
  const delHabit = (id) => setStreaks((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== id) }))

  /* vitals history — last 28 days shaped for the bar tracker */
  const vitalsHist = useMemo(() => {
    if (!vitals) return null
    const series = last28.map((iso) => ({ iso, steps: vitals[iso]?.steps, exercise: vitals[iso]?.exercise }))
    const stepVals = series.map((d) => d.steps).filter((n) => typeof n === 'number')
    const exVals = series.map((d) => d.exercise).filter((n) => typeof n === 'number')
    const logged = series.filter((d) => d.steps != null || d.exercise != null).length
    const avg = (a) => (a.length ? Math.round(a.reduce((s, n) => s + n, 0) / a.length) : 0)
    return {
      series, logged,
      maxSteps: Math.max(1, ...stepVals),
      avgSteps: avg(stepVals),
      maxEx: Math.max(1, ...exVals),
      avgEx: avg(exVals),
    }
  }, [vitals, last28])

  /* captain's log — one line per day; saving again overwrites today's line */
  const todayLog = logEntries.find((e) => e.d === todayISO)
  const saveLog = () => {
    const text = logDraft.trim()
    if (!text) return
    setLogEntries((es) => [{ d: todayISO, t: text }, ...es.filter((e) => e.d !== todayISO)])
    setLogDraft('')
  }

  const openTodos = todos.filter((t) => !t.done).length

  return (
    <div className="term">
      {/* ---------- MASTHEAD ---------- */}
      <header className="term-bar">
        <div className="bar-brand">
          <span className="glyph" aria-hidden="true">&gt;<i /></span>
          <b>TAJAR&nbsp;TERMINAL</b>
          <span>PERSONAL DESK</span>
        </div>
        <div className="bar-stats">
          <div className="bar-stat date"><u>DATE</u><b>{dateStr}</b></div>
          <div className="bar-stat now"><u>GREENWICH</u><b>{wx ? `${wx.temp}°F ${wx.label}` : '—'}</b></div>
          {(wx?.days || []).slice(0, 5).map((day, i) => (
            <div className="bar-stat fc" key={day.date} title={`${day.date} · ${wmoLabel(day.code)}`}>
              <u>{i === 0 ? 'TODAY' : new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parseMid(day.date)).toUpperCase()}</u>
              <b><WxIcon code={day.code} size={13} />{day.hi}°<i>/{day.lo}°</i></b>
            </div>
          ))}
        </div>
        <div className="bar-clock">
          <time>{clock}<span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1 }}> ET</span></time>
          <button className="sober-chip" onClick={() => setEditSober((v) => !v)} title="Sober day counter — tap to set start date">
            SOBER <b>{sober.days}D</b>
          </button>
          {editSober && (
            <span className="sober-date-edit" style={{ marginTop: 0 }}>
              <input type="date" value={soberStart} max={new Intl.DateTimeFormat('en-CA').format(now)}
                onChange={(e) => e.target.value && setSoberStart(e.target.value)} />
              <button onClick={() => setEditSober(false)}>OK</button>
            </span>
          )}
        </div>
      </header>

      {/* ---------- WIRE TAPE ---------- */}
      <div className="tape" aria-hidden="true">
        <div className="tape-track" ref={tapeRef}>
          {[0, 1].map((rep) => (
            <span key={rep}>
              {wx && (
                <span className="tape-item">
                  <b>GREENWICH</b>
                  <span className="px">{wx.temp}°F {wx.label}</span>
                  <span className="chg down">{wx.precip}% PRECIP</span>
                </span>
              )}
              {mkt.movers.map((r) => (
                <span className="tape-item" key={`${r.sym}-${rep}`}>
                  <b>{r.sym}</b>
                  <span className="px">{px(r.last)}</span>
                  <span className={`chg ${r.chgPct >= 0 ? 'up' : 'down'}`}>{pct(r.chgPct)}</span>
                </span>
              ))}
              <span className="tape-item">
                <b>BOOK</b>
                <span className="px">{usdShort(mkt.netLiq)}</span>
                <span className={`chg ${mkt.dayPnl >= 0 ? 'up' : 'down'}`}>{pct(mkt.dayPct)}</span>
              </span>
              {wire.map((n, i) => (
                <span className="tape-item" key={`w${i}-${rep}`}>
                  <b>{n.src}</b>
                  <span className="px">{n.title}</span>
                </span>
              ))}
              {wire.length === 0 && (
                <span className="tape-item">
                  <b>WIRE</b>
                  <span className="px">Awaiting headlines</span>
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="term-grid">
        {/* ---------- TODAY ---------- */}
        <section className="panel span-2">
          <div className="panel-head">
            <h2>TODAY · {dateStr}</h2>
            <span className="meta">{todaySchedule.length} EVENT{todaySchedule.length === 1 ? '' : 'S'} · <b>{openTodos}</b> TO DO</span>
          </div>

          <div className="focus">
            <u>
              TODAY&rsquo;S FOCUS
              {!editFocus && <button onClick={openFocusEdit}>EDIT</button>}
            </u>
            {editFocus ? (
              <div className="edit-row">
                <input
                  autoFocus value={focusDraft}
                  onChange={(e) => setFocusDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveFocus()}
                  placeholder="The one thing that defines today"
                />
                <button onClick={saveFocus}>SET</button>
              </div>
            ) : focus ? (
              <h1 onClick={openFocusEdit}>{focus}<span className="cursor" aria-hidden="true" /></h1>
            ) : (
              <h1 className="empty" onClick={openFocusEdit}>Tap to set today&rsquo;s one focus<span className="cursor" aria-hidden="true" /></h1>
            )}
          </div>

          {wx && (
            <div className="wx-strip">
              <span><u>NOW</u><b>{wx.temp}°F</b></span>
              <span><u>FEELS</u><b>{wx.feels}°F</b></span>
              <span><u>HI / LO</u><b>{wx.hi}° / {wx.lo}°</b></span>
              <span><u>PRECIP</u><b>{wx.precip}%</b></span>
              <span><u>WIND</u><b>{wx.wind} MPH</b></span>
              <span><u>SUN</u><b>{wx.sunrise}–{wx.sunset}</b></span>
              {nextTide.high && (
                <span title={`Next high tide · Cos Cob Harbor · ${nextTide.high.ft} ft`}>
                  <u>HIGH TIDE</u>
                  <b className="tide-hi">▲ {nextTide.high.at}{nextTide.high.tmrw ? '+1' : ''} <i>{nextTide.high.ft}FT</i></b>
                </span>
              )}
              {nextTide.low && (
                <span title={`Next low tide · Cos Cob Harbor · ${nextTide.low.ft} ft`}>
                  <u>LOW TIDE</u>
                  <b className="tide-lo">▼ {nextTide.low.at}{nextTide.low.tmrw ? '+1' : ''} <i>{nextTide.low.ft}FT</i></b>
                </span>
              )}
            </div>
          )}


          {(() => {
            if (!vitals) return null
            const ydaISO = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
            const t = vitals[todayISO]
            const y = vitals[ydaISO]
            if (!t && !y) return null
            return (
              <div className="wx-strip vitals-strip">
                <span><u>VITALS</u><b className="vit-src">HEALTH</b></span>
                {t?.steps != null && <span><u>STEPS</u><b>{t.steps.toLocaleString()}</b></span>}
                {t?.exercise != null && <span><u>EXERCISE</u><b>{t.exercise} MIN</b></span>}
                {y?.steps != null && <span><u>YDA STEPS</u><b className="muted">{y.steps.toLocaleString()}</b></span>}
                {y?.exercise != null && <span><u>YDA EX</u><b className="muted">{y.exercise} MIN</b></span>}
              </div>
            )
          })()}

          <div className="agenda">
            {!calOK && (
              <div className="agenda-empty">
                Calendar not synced for today — last sync {fmtDate(SCHEDULE_FOR)}. The morning refresh will update it.
              </div>
            )}
            {calOK && todaySchedule.length === 0 && <div className="agenda-empty">No commitments today. Clear board.</div>}
            {todaySchedule.map((e, i) => {
              const active = nowHM >= e.start && nowHM < e.end
              return (
                <div className="agenda-row" key={i}>
                  <div className="agenda-time">{e.start}<small>{e.end}</small></div>
                  <div className="agenda-body">
                    <h3>{e.title}{e.cal && <span className="cal-tag">{e.cal}</span>}</h3>
                    {e.note && <p>{e.note}</p>}
                    {active && <span className="now">&#9679; NOW</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="todo-add">
            <input
              value={todoDraft}
              onChange={(e) => setTodoDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              placeholder="ADD A MUST-DO — PRESS ENTER"
            />
            <button onClick={addTodo}>+ ADD</button>
          </div>
          <div className="todo-list">
            {todos.map((t) => (
              <button className={`todo-item ${t.done ? 'done' : ''}`} key={t.id} onClick={() => toggleTodo(t.id)}>
                <span className="todo-box">{t.done ? '✓' : ''}</span>
                <span className="txt">{t.text}</span>
                <span className="todo-del" onClick={(e) => { e.stopPropagation(); delTodo(t.id) }} aria-label="delete">&#10005;</span>
              </button>
            ))}
          </div>
        </section>

        {/* ---------- WEEK AHEAD ---------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>WEEK AHEAD</h2>
            <span className="meta">{weekMeta}</span>
          </div>
          <div className="week-list">
            {weekRows.length === 0 && (
              <div className="agenda-empty">Week not synced — awaiting the morning refresh.</div>
            )}
            {weekRows.map((d) => (
              <div className="week-row" key={d.day}>
                <div className="week-day"><b>{d.day}</b><small>{d.date}</small></div>
                <div className="week-items">
                  {d.items.map((it, i) => (
                    <p key={i} className={it.hot ? 'hot' : ''}>
                      <span>{it.t}</span> {it.s}{it.cal && <span className="cal-tag">{it.cal}</span>}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- HORIZON ---------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>HORIZON · NEXT WEEKS</h2>
            <span className="meta">GOALS &amp; OBLIGATIONS</span>
          </div>
          <div className="hz-add">
            <span className="prompt">&gt;</span>
            <input value={hzDraft} onChange={(e) => setHzDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addHorizon()}
              placeholder="ADD GOAL · END WITH A DATE — JUL 23 · 7/23 · IN 10D · FRI" />
            {hzParsed?.date && (
              <span className="hz-preview">
                {fmtDate(hzParsed.date)} · T-{daysUntil(hzParsed.date, now)}D
              </span>
            )}
          </div>
          <div className="horizon-list">
            {horizonSorted.length === 0 && <div className="agenda-empty">Nothing on the horizon yet. Add your goals above.</div>}
            {horizonSorted.map((h) => {
              const tone = h.kind === 'MILESTONE' ? 'mile' : h.t === Infinity ? 'far' : h.t <= 3 ? 'soon' : h.t <= 10 ? 'near' : 'far'
              return (
                <div className="horizon-row" key={h.id}>
                  <div className={`tminus ${tone}`}>
                    {h.t === Infinity ? <b>&mdash;</b> : h.t <= 0 ? <b>DUE</b> : <><b>{h.t}</b><small>DAYS</small></>}
                  </div>
                  <div className="hz-body">
                    <span className="hz-del" onClick={() => delHorizon(h.id)} aria-label="delete">&#10005;</span>
                    <h3>{h.label}{h.kind && <span className="kind">{h.kind}</span>}</h3>
                    {(h.date || h.note) && (
                      <p>{h.date ? fmtDate(h.date) : ''}{h.date && h.note ? ' · ' : ''}{h.note || ''}</p>
                    )}
                    {typeof h.progress === 'number' && (
                      <div className="hz-progress"><span style={{ width: `${h.progress}%` }} /></div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------- STREAKS ---------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>STREAKS · 28D</h2>
            <span className="meta">TAP A ROW = DONE TODAY</span>
          </div>
          <div className="streak-list">
            {streaks.habits.map((h) => {
              const marked = new Set(streaks.marks[h.id] || [])
              const doneToday = marked.has(todayISO)
              return (
                <button className={`streak-row ${doneToday ? 'done' : ''}`} key={h.id}
                  onClick={() => toggleMark(h.id, todayISO)}>
                  <span className="streak-name">
                    {h.name}
                    <span className="streak-del"
                      onClick={(e) => { e.stopPropagation(); delHabit(h.id) }} aria-label="delete">&#10005;</span>
                  </span>
                  <span className="streak-cells">
                    {last28.map((iso) => (
                      <i
                        key={iso}
                        className={`cell ${marked.has(iso) ? 'on' : ''} ${iso === todayISO ? 'today' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleMark(h.id, iso) }}
                        title={iso}
                      />
                    ))}
                  </span>
                  <span className={`streak-today ${doneToday ? 'on' : ''}`}>{doneToday ? '✓' : ''}</span>
                  <span className="streak-count">{streakCount(h.id)}D</span>
                </button>
              )
            })}
          </div>
          <div className="todo-add">
            <input value={habitDraft} onChange={(e) => setHabitDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()} placeholder="ADD A HABIT — PRESS ENTER" />
            <button onClick={addHabit}>+ ADD</button>
          </div>
        </section>

        {/* ---------- CAPTAIN'S LOG ---------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>CAPTAIN&rsquo;S LOG</h2>
            <span className="meta">{logEntries.length} ENTRIES</span>
          </div>
          <div className="todo-add">
            <input value={logDraft} onChange={(e) => setLogDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveLog()}
              placeholder={todayLog ? 'REWRITE TODAY’S LINE — PRESS ENTER' : 'ONE LINE ABOUT TODAY — PRESS ENTER'} />
            <button onClick={saveLog}>LOG</button>
          </div>
          <div className="log-list">
            {logEntries.length === 0 && <div className="agenda-empty">No entries yet. One honest line a day.</div>}
            {logEntries.slice(0, 10).map((e) => (
              <div className="log-row" key={e.d}>
                <span className="log-date">{fmtDate(e.d)}</span>
                <p>{e.t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- VITALS TRACKER ---------- */}
        {syncKey && (
          <section className="panel">
            <div className="panel-head">
              <h2>VITALS · 28D</h2>
              <span className="meta">{vitalsHist ? `${vitalsHist.logged} DAYS LOGGED` : 'AWAITING SYNC'}</span>
            </div>
            {!vitalsHist || vitalsHist.logged === 0 ? (
              <div className="agenda-empty">Awaiting pushes — bars appear after tonight&rsquo;s 11:59 PM sync.</div>
            ) : (
              <>
                <div className="chart-block">
                  <div className="chart-label">
                    <u>STEPS</u>
                    <span>AVG <b>{vitalsHist.avgSteps.toLocaleString()}</b> · BEST <b>{vitalsHist.maxSteps.toLocaleString()}</b></span>
                  </div>
                  <div className="bars steps">
                    {vitalsHist.series.map((d) => (
                      <i key={d.iso} title={`${d.iso} · ${d.steps != null ? d.steps.toLocaleString() + ' steps' : 'no data'}`}
                        className={d.iso === todayISO ? 'cur' : ''}
                        style={{ height: d.steps != null ? `${Math.max(6, (d.steps / vitalsHist.maxSteps) * 100)}%` : '2px' }} />
                    ))}
                  </div>
                </div>
                <div className="chart-block">
                  <div className="chart-label">
                    <u>EXERCISE MIN</u>
                    <span>AVG <b>{vitalsHist.avgEx}</b> · BEST <b>{vitalsHist.maxEx}</b></span>
                  </div>
                  <div className="bars ex">
                    {vitalsHist.series.map((d) => (
                      <i key={d.iso} title={`${d.iso} · ${d.exercise != null ? d.exercise + ' min' : 'no data'}`}
                        className={d.iso === todayISO ? 'cur' : ''}
                        style={{ height: d.exercise != null ? `${Math.max(6, (d.exercise / vitalsHist.maxEx) * 100)}%` : '2px' }} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* ---------- GROUNDING ---------- */}
        <section className={`panel ${syncKey ? '' : 'span-2'}`}>
          <div className="panel-head">
            <h2>GROUNDING</h2>
            <span className="meta">WHY</span>
          </div>
          <div className="ground">
            <div className="quote">
              <p>&ldquo;{quote.t}&rdquo;</p>
              <cite>&mdash; {quote.by}</cite>
            </div>
            {why && (
              <div className="why-line">
                <u>YOUR WHY · TODAY</u>
                <p>{why}</p>
              </div>
            )}
            <div className="reasons">
              {reasons.length === 0 && <div className="reason-empty">Add your own reasons — they rotate here daily.</div>}
              {reasons.map((r, i) => (
                <div className="reason-row" key={i}>
                  <span className="rdot">&#9642;</span>
                  <span className="rtext">{r}</span>
                  <span className="rdel" onClick={() => delReason(i)} aria-label="delete">&#10005;</span>
                </div>
              ))}
            </div>
            <div className="todo-add">
              <input value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addReason()} placeholder="ADD A REASON WHY — PRESS ENTER" />
              <button onClick={addReason}>+ ADD</button>
            </div>
          </div>
        </section>

        {/* ---------- MARKETS (collapsed strip) ---------- */}
        <section className="panel span-2">
          <div className="panel-head mkt-head" onClick={() => setMktOpen((v) => !v)}>
            <h2>MARKETS</h2>
            <span className="meta">
              <span className={`mkt ${marketStatus.open ? 'open' : 'closed'}`}><i className="dot" />{marketStatus.label}</span>
              {' '}· NETLIQ <b>{usdShort(mkt.netLiq)}</b> · <span className={cls(mkt.dayPnl)}>{pct(mkt.dayPct)}</span>
              <span className="chev"> &nbsp;{mktOpen ? '▲ HIDE' : '▼ BOOK'}</span>
            </span>
          </div>
          {!mktOpen ? (
            <div className="mkt-strip">
              <div className="cell"><u>NET LIQ</u><b>{usdShort(mkt.netLiq)}</b></div>
              <div className="cell"><u>DAY P&amp;L</u><b className={cls(mkt.dayPnl)}>{usdShort(mkt.dayPnl)}</b></div>
              <div className="movers">
                {mkt.movers.map((m) => (
                  <span className="mv" key={m.sym}>
                    <b>{m.sym}</b> <span className={cls(m.chgPct)}>{pct(m.chgPct)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="pf-table">
              <table className="book">
                <thead>
                  <tr><th>SYMBOL</th><th>LAST</th><th>CHG%</th><th>DAY P&amp;L</th><th>MKT VAL</th></tr>
                </thead>
                <tbody>
                  {[...rows].sort((a, b) => b.dayPnl - a.dayPnl).map((r) => (
                    <tr key={r.sym}>
                      <td className="sym">
                        <b>{r.sym}</b>
                        <span className={`ls ${r.qty >= 0 ? 'long' : 'short'}`}>{r.qty >= 0 ? 'L' : 'S'} {Math.abs(r.qty).toLocaleString()}</span>
                        <small>{r.name}</small>
                      </td>
                      <td>{px(r.last)}</td>
                      <td className={cls(r.chgPct)}>{pct(r.chgPct)}</td>
                      <td className={cls(r.dayPnl)}>{(r.dayPnl >= 0 ? '+' : '') + usdShort(r.dayPnl)}</td>
                      <td className="muted">{usdShort(r.mv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ---------- FOOTER ---------- */}
      <footer className="term-foot">
        <span className="data-note">
          {syncStatus === 'ok' ? 'PRIVATE · SYNCED TO YOUR CLOUD STORE' : 'PRIVATE · STORED ON THIS DEVICE'}
          {' · QUOTES '}{live ? 'LIVE (YAHOO)' : 'SNAPSHOT'}
        </span>
        {editSync ? (
          <span className="sync-edit">
            <input
              autoFocus type="password" value={syncDraft}
              onChange={(e) => setSyncDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSyncKey()}
              placeholder="SYNC KEY"
            />
            <button onClick={saveSyncKey}>SET</button>
          </span>
        ) : (
          <button className={`sync-chip ${syncStatus}`} onClick={() => setEditSync(true)}
            title="Cloud sync — tap to set your sync key">
            <i className="dot" />
            SYNC {syncStatus === 'ok' ? 'ON' : syncStatus === 'err' ? 'ERR' : 'OFF'}
          </button>
        )}
      </footer>
    </div>
  )
}
