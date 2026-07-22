/* ============================================================
   Sync merge core — item-level, timestamped, tombstoned.

   Whole-blob last-write-wins loses data the moment two devices are
   both in use: the staler device's next push overwrites the other's
   edits. Instead every item carries `mt` (modified-time, ms) and
   deletions become tombstones (`del: 1`) that the UI hides — so a
   merge can always pick the newer version of each item, and a
   deletion can never be resurrected by a stale copy.

   Legacy data (no mt) is normalized with mt = 0, which any real
   edit outranks.
   ============================================================ */

const TOMBSTONE_TTL = 60 * 86400000 // purge deleted items after 60 days

const newer = (a, b) => {
  if (!a) return b
  if (!b) return a
  return (a.mt || 0) >= (b.mt || 0) ? a : b
}
const livePurge = (item, now) => !(item?.del && (now - (item.mt || 0)) > TOMBSTONE_TTL)

/* ---------- normalizers (idempotent; accept legacy shapes) ---------- */

export function normTodos(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .filter((t) => t && t.id != null && typeof t.text === 'string')
    .map((t) => ({ id: t.id, text: t.text, done: !!t.done, mt: t.mt || 0, ...(t.del ? { del: 1 } : {}) }))
}

export function normHorizon(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .filter((h) => h && h.id != null && typeof h.label === 'string')
    .map((h) => ({
      id: h.id, label: h.label, date: h.date || null, note: h.note || '',
      progress: typeof h.progress === 'number' ? h.progress : null,
      ...(h.kind ? { kind: h.kind } : {}),
      mt: h.mt || 0, ...(h.del ? { del: 1 } : {}),
    }))
}

/* streaks: marks migrate from {hid: ['date', ...]} (legacy) to
   {hid: {date: {on: 0|1, mt}}} so un-marking can win over a stale mark */
export function normStreaks(s) {
  const habits = Array.isArray(s?.habits)
    ? s.habits
      .filter((h) => h && h.id != null && typeof h.name === 'string')
      .map((h) => ({ id: h.id, name: h.name, mt: h.mt || 0, ...(h.del ? { del: 1 } : {}) }))
    : []
  const marks = {}
  if (s?.marks && typeof s.marks === 'object') {
    for (const hid of Object.keys(s.marks)) {
      const m = s.marks[hid]
      if (Array.isArray(m)) {
        marks[hid] = {}
        for (const d of m) if (typeof d === 'string') marks[hid][d] = { on: 1, mt: 0 }
      } else if (m && typeof m === 'object') {
        marks[hid] = {}
        for (const d of Object.keys(m)) {
          const v = m[d]
          if (v && typeof v === 'object') marks[hid][d] = { on: v.on ? 1 : 0, mt: v.mt || 0 }
        }
      }
    }
  }
  return { habits, marks }
}

/* ---------- merges (remote ⊕ local, per item, newer mt wins) ---------- */

function mergeById(a = [], b = [], now = Date.now()) {
  const m = new Map()
  for (const item of a) m.set(item.id, item)
  for (const item of b) m.set(item.id, m.has(item.id) ? newer(item, m.get(item.id)) : item)
  return [...m.values()].filter((it) => livePurge(it, now))
}

export function mergeTodos(remote, local, now = Date.now()) {
  return mergeById(normTodos(remote), normTodos(local), now)
}

export function mergeHorizon(remote, local, now = Date.now()) {
  return mergeById(normHorizon(remote), normHorizon(local), now)
}

export function mergeStreaks(remote, local, now = Date.now()) {
  const r = normStreaks(remote)
  const l = normStreaks(local)
  const habits = mergeById(r.habits, l.habits, now)
  const marks = {}
  const hids = new Set([...Object.keys(r.marks), ...Object.keys(l.marks)])
  for (const hid of hids) {
    marks[hid] = {}
    const dates = new Set([...Object.keys(r.marks[hid] || {}), ...Object.keys(l.marks[hid] || {})])
    for (const d of dates) {
      const w = newer(r.marks[hid]?.[d], l.marks[hid]?.[d])
      if (w) marks[hid][d] = w
    }
  }
  return { habits, marks }
}

export function mergeReasons(remote = [], local = []) {
  const seen = new Set()
  const out = []
  for (const r of [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]) {
    if (typeof r !== 'string') continue
    const k = r.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

export function mergeLogs(a = [], b = []) {
  const m = new Map()
  for (const e of Array.isArray(b) ? b : []) if (e?.d) m.set(e.d, e)
  for (const e of Array.isArray(a) ? a : []) if (e?.d) m.set(e.d, e)
  return [...m.values()].sort((x, y) => y.d.localeCompare(x.d))
}

/* Merge two full state blobs. Collections merge item-wise (safe in any
   order); scalars (focus, soberStart) go to whichever blob is newer. */
export function mergeState(remote = {}, local = {}, remoteNewer = false, now = Date.now()) {
  const scalars = remoteNewer ? remote : local
  const fallback = remoteNewer ? local : remote
  return {
    soberStart: scalars.soberStart || fallback.soberStart || null,
    focus: typeof scalars.focus === 'string' ? scalars.focus : (fallback.focus || ''),
    todos: mergeTodos(remote.todos, local.todos, now),
    horizon: mergeHorizon(remote.horizon, local.horizon, now),
    streaks: mergeStreaks(remote.streaks, local.streaks, now),
    reasons: mergeReasons(remote.reasons, local.reasons),
    logEntries: mergeLogs(remote.logEntries, local.logEntries),
  }
}
