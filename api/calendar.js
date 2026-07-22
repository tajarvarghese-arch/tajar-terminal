// Vercel serverless function — live calendar via Google's secret iCal feed.
// Setup: Google Calendar (web) → Settings → your calendar → "Integrate
// calendar" → copy "Secret address in iCal format" → store as the
// CAL_ICS_URL environment variable in Vercel. The URL never reaches the
// browser; requests are guarded by the same sync key as everything else.
//
//   GET /api/health-of-day  ->  (see /api/calendar)
//   GET /api/calendar  -> { days: { 'YYYY-MM-DD': [{ t, e, s, loc }] }, ts }
//       t/e = start/end 'HH:MM' ET · s = title · loc = short location

import ical from 'node-ical'

const TZ = 'America/New_York'
const WINDOW_DAYS = 8 // today + 7

const hm = (d) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
const isoDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

/* Expand an ICS text into a days map for [now .. now + WINDOW_DAYS).
   Handles RRULE recurrence, EXDATE exclusions, and per-instance
   overrides (RECURRENCE-ID). All-day and cancelled events are skipped. */
export function buildDays(icsText, now = new Date()) {
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
    ;(days[iso] ||= []).push({ t: hm(f.start), e: hm(f.end), s: f.s, ...(f.loc ? { loc: f.loc } : {}) })
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
    const r = await fetch(icsUrl, { headers: { 'User-Agent': 'tajar-terminal/1.0' } })
    if (!r.ok) throw new Error(`ics ${r.status}`)
    const days = buildDays(await r.text())
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
    res.status(200).json({ days, ts: Date.now() })
  } catch {
    res.status(502).json({ error: 'calendar feed unavailable' })
  }
}
