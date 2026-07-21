// Vercel serverless function — personal state sync.
// Backed by Upstash Redis (Vercel Marketplace integration provides
// KV_REST_API_URL / KV_REST_API_TOKEN env vars automatically).
// Auth: requests must carry the user's private sync key in the
// x-sync-key header, matched against the SYNC_SECRET env var.
//
//   GET  /api/state  -> { data, updatedAt } | { data: null }
//   PUT  /api/state  body: { data, updatedAt } -> { ok: true }

const KEY = 'tajar-terminal-state'

function env() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  const secret = process.env.SYNC_SECRET
  return { url, token, secret }
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
    const r = await fetch(`${url}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      res.status(502).json({ error: 'store unavailable' })
      return
    }
    const { result } = await r.json()
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json(result ? JSON.parse(result) : { data: null })
    return
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (!body || body.length > 512_000) {
      res.status(400).json({ error: 'bad payload' })
      return
    }
    const r = await fetch(`${url}/set/${KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
    if (!r.ok) {
      res.status(502).json({ error: 'store unavailable' })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ error: 'method not allowed' })
}
