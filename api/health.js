// Vercel serverless function — daily health stats from iOS Shortcuts.
// Same auth + store as /api/state: x-sync-key header vs SYNC_SECRET,
// Upstash Redis via KV_REST_API_URL / KV_REST_API_TOKEN.
//
//   POST /api/health  body: { date?: 'YYYY-MM-DD', steps?: n, exercise?: n }
//        (date defaults to today in America/New_York; same-day posts overwrite)
//   GET  /api/health  -> { days: { 'YYYY-MM-DD': { steps, exercise } } }

const KEY = 'tajar-health'
const KEEP_DAYS = 1095 // three years — enough history to plot real patterns

function env() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  const secret = process.env.SYNC_SECRET
  return { url, token, secret }
}

const todayET = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())

/* Accept two payload shapes, returning { 'YYYY-MM-DD': { steps?, exercise? } }:
   1. Simple (iOS Shortcuts): { date?, steps?, exercise? }
   2. Health Auto Export app: { data: { metrics: [{ name, data: [{ date, qty }] }] } }
      — HAE reads HealthKit's statistics engine, so its numbers match
      the Health app exactly. */
export function parseHealthPayload(body, fallbackDate) {
  const updates = {}
  if (Array.isArray(body?.data?.metrics)) {
    const nameMap = {
      step_count: 'steps', steps: 'steps',
      apple_exercise_time: 'exercise', exercise_time: 'exercise', exercise_minutes: 'exercise',
    }
    for (const metric of body.data.metrics) {
      const field = nameMap[String(metric?.name || '').toLowerCase()]
      if (!field || !Array.isArray(metric.data)) continue
      for (const point of metric.data) {
        const date = String(point?.date || '').slice(0, 10)
        const qty = Number(point?.qty)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(qty) || qty < 0) continue
        ;(updates[date] ||= {})[field] = Math.round(qty)
      }
    }
  } else {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : fallbackDate
    const steps = Number(body.steps)
    const exercise = Number(body.exercise ?? body.exerciseMinutes)
    const entry = {}
    if (Number.isFinite(steps) && steps >= 0) entry.steps = Math.round(steps)
    if (Number.isFinite(exercise) && exercise >= 0) entry.exercise = Math.round(exercise)
    if (Object.keys(entry).length) updates[date] = entry
  }
  return updates
}

async function redis(url, token, path, body) {
  const r = await fetch(`${url}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  if (!r.ok) throw new Error(`redis ${r.status}`)
  return r.json()
}

export default async function handler(req, res) {
  const { url, token, secret } = env()
  if (!url || !token || !secret) {
    res.status(503).json({ error: 'sync not configured' })
    return
  }
  if (req.headers['x-sync-key'] !== secret) {
    res.status(401).json({ error: 'bad sync key' })
    return
  }

  if (req.method === 'GET') {
    const { result } = await redis(url, token, `/get/${KEY}`)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json(result ? JSON.parse(result) : { days: {} })
    return
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'bad payload' })
      return
    }

    const updates = parseHealthPayload(body, todayET())
    if (!Object.keys(updates).length) {
      res.status(400).json({ error: 'no usable metrics' })
      return
    }

    const { result } = await redis(url, token, `/get/${KEY}`)
    const blob = result ? JSON.parse(result) : { days: {} }
    for (const [date, entry] of Object.entries(updates)) {
      blob.days[date] = { ...blob.days[date], ...entry, ts: Date.now() }
    }

    // trim history
    const keys = Object.keys(blob.days).sort()
    while (keys.length > KEEP_DAYS) delete blob.days[keys.shift()]

    await redis(url, token, `/set/${KEY}`, JSON.stringify(blob))
    res.status(200).json({ ok: true, saved: updates })
    return
  }

  res.status(405).json({ error: 'method not allowed' })
}
