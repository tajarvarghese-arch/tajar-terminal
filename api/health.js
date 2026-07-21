// Vercel serverless function — daily health stats from iOS Shortcuts.
// Same auth + store as /api/state: x-sync-key header vs SYNC_SECRET,
// Upstash Redis via KV_REST_API_URL / KV_REST_API_TOKEN.
//
//   POST /api/health  body: { date?: 'YYYY-MM-DD', steps?: n, exercise?: n }
//        (date defaults to today in America/New_York; same-day posts overwrite)
//   GET  /api/health  -> { days: { 'YYYY-MM-DD': { steps, exercise } } }

const KEY = 'tajar-health'
const KEEP_DAYS = 120

function env() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  const secret = process.env.SYNC_SECRET
  return { url, token, secret }
}

const todayET = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())

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
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : todayET()
    const steps = Number(body.steps)
    const exercise = Number(body.exercise ?? body.exerciseMinutes)
    const entry = {}
    if (Number.isFinite(steps) && steps >= 0) entry.steps = Math.round(steps)
    if (Number.isFinite(exercise) && exercise >= 0) entry.exercise = Math.round(exercise)
    if (!Object.keys(entry).length) {
      res.status(400).json({ error: 'no usable metrics' })
      return
    }

    const { result } = await redis(url, token, `/get/${KEY}`)
    const blob = result ? JSON.parse(result) : { days: {} }
    blob.days[date] = { ...blob.days[date], ...entry, ts: Date.now() }

    // trim history
    const keys = Object.keys(blob.days).sort()
    while (keys.length > KEEP_DAYS) delete blob.days[keys.shift()]

    await redis(url, token, `/set/${KEY}`, JSON.stringify(blob))
    res.status(200).json({ ok: true, date, saved: entry })
    return
  }

  res.status(405).json({ error: 'method not allowed' })
}
