// Vercel serverless function — live calendar via Google secret iCal feeds.
// Setup: Google Calendar (web) → Settings → each calendar → "Integrate
// calendar" → copy "Secret address in iCal format" → store in the
// CAL_ICS_URL environment variable in Vercel. Multiple calendars are
// comma-separated, each optionally prefixed with a short label:
//   CAL_ICS_URL = https://.../basic.ics, FAM|https://.../family.ics
// Labeled feeds tag their events (shown as a chip in the UI). URLs never
// reach the browser; requests are guarded by the same sync key.
//
//   GET /api/calendar  -> { days: { 'YYYY-MM-DD': [{ t, e, s, loc, cal? }] }, ts }
//       t/e = start/end 'HH:MM' ET · s = title · loc = short location

import ical from 'node-ical'

const TZ = 'America/New_York'
const WINDOW_DAYS = 8 // today + 7

const hm = (d) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
const isoDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

/* Expand an ICS text into a days map for [now .. now + WINDOW_DAYS).
   Handles RRULE recurrence, EXDATE exclusions, and per-instance
   overrides (RECURRENCE-ID). All-day and cancelled events are skipped. */
export function buildDays(icsText, now = new Date(), label = '') {
  const data = ical.sync.parseICS(icsText)
  const winStart = new Date(now.getTime() - 6 * 3600000) // catch events already underway
  const winEnd = new Date(now.getTime() + WINDOW_DAYS * 86400000)
  const found = []

  for (const key of Object.keys(data)) {
    const ev = data[key]
    if (!ev || ev.type !== 'VEVENT' || !ev.start) continue
    if (String(ev.status || '').toUpperCase() === 'CANCELLED') continue
    if (ev.datetype === 'date') continue // all-day

    const dur = Math.max(0, (ev.end?.getTime() ?? ev.start.getTime()) - ev.start.getTime())
    const overrides = ev.recurrences ? Object.values(ev.recurrences) : []
    const overriddenAt = new Set(overrides.map((o) => o.recurrenceid?.getTime()).filter(Boolean))
    const excludedAt = new Set(Object.values(ev.exdate || {}).map((d) => new Date(d).getTime()))

    const push = (start, end, src) => {
      if (end <= winStart || start >= winEnd) return
      found.push({
        start, end,
        s: (src.summary || '').toString().trim() || '(untitled)',
        loc: (src.location || '').toString().split(/[\n,]/)[0].trim().slice(0, 44),
        cal: label,
      })
    }

    if (ev.rrule) {
      for (const d of ev.rrule.between(new Date(winStart.getTime() - dur), winEnd, true)) {
        const t = d.getTime()
        if (excludedAt.has(t) || overriddenAt.has(t)) continue
        push(d, new Date(t + dur), ev)
      }
    } else {
      push(ev.start, ev.end ?? ev.start, ev)
    }
    for (const o of overrides) {
      if (String(o.status || '').toUpperCase() === 'CANCELLED') continue
      if (o.start) push(o.start, o.end ?? o.start, o)
    }
  }

  // group by ET day, sort, dedupe exact title+start repeats
  const days = {}
  const seen = new Set()
  found.sort((a, b) => a.start - b.start)
  for (const f of found) {
    const dupKey = `${f.start.getTime()}|${f.s.toLowerCase()}`
    if (seen.has(dupKey)) continue
    seen.add(dupKey)
    const iso = isoDay(f.start)
    ;(days[iso] ||= []).push({
      t: hm(f.start), e: hm(f.end), s: f.s,
      ...(f.loc ? { loc: f.loc } : {}),
      ...(f.cal ? { cal: f.cal } : {}),
    })
  }
  return days
}

/* Fuzzy duplicate detection: users create literal duplicates (a ticket
   email import plus a manual entry). Same start time + ≥60% word
   overlap (case/punctuation-insensitive) counts as one event. */
const normTitle = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
function similarTitles(a, b) {
  const A = new Set(normTitle(a).split(' ').filter(Boolean))
  const B = new Set(normTitle(b).split(' ').filter(Boolean))
  if (!A.size || !B.size) return false
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter) >= 0.6
}
export function dedupeDay(items) {
  const out = []
  for (const it of items) {
    const dup = out.find((o) => o.t === it.t && similarTitles(o.s, it.s))
    if (dup) {
      // keep the richer record: fill a missing location, prefer the longer title
      if (!dup.loc && it.loc) dup.loc = it.loc
      if (it.s.length > dup.s.length) dup.s = it.s
      continue
    }
    out.push(it)
  }
  return out
}

/* Merge day-maps from several feeds: concat, re-sort, fuzzy-dedupe. */
export function mergeDays(maps) {
  const days = {}
  for (const m of maps) {
    for (const iso of Object.keys(m)) {
      ;(days[iso] ||= []).push(...m[iso])
    }
  }
  for (const iso of Object.keys(days)) {
    days[iso].sort((a, b) => a.t.localeCompare(b.t))
    days[iso] = dedupeDay(days[iso])
  }
  return days
}

export default async function handler(req, res) {
  const secret = process.env.SYNC_SECRET
  const icsUrl = process.env.CAL_ICS_URL
  if (!secret || !icsUrl) {
    res.status(503).json({ error: 'calendar not configured' })
    return
  }
  if (req.headers['x-sync-key'] !== secret) {
    res.status(401).json({ error: 'bad sync key' })
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  try {
    /* "url" or "LABEL|url", comma-separated */
    const feeds = icsUrl.split(',').map((entry) => {
      const e = entry.trim()
      const bar = e.indexOf('|')
      return bar > 0 && !e.slice(0, bar).includes('://')
        ? { label: e.slice(0, bar).trim().toUpperCase().slice(0, 6), url: e.slice(bar + 1).trim() }
        : { label: '', url: e }
    }).filter((f) => f.url)

    const now = new Date()
    const maps = await Promise.all(feeds.map(async ({ label, url }) => {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'tajar-terminal/1.0' } })
        if (!r.ok) throw new Error(`ics ${r.status}`)
        return buildDays(await r.text(), now, label)
      } catch {
        return null // one broken feed shouldn't blank the rest
      }
    }))
    const good = maps.filter(Boolean)
    if (!good.length) throw new Error('all feeds failed')

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
    res.status(200).json({ days: mergeDays(good), ts: Date.now(), feeds: feeds.length, ok: good.length })
  } catch {
    res.status(502).json({ error: 'calendar feed unavailable' })
  }
}
