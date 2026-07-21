// Vercel serverless function — holdings news proxy.
// Pulls Yahoo Finance headline RSS per symbol (no API key), merges, sorts
// by recency. GET /api/news?symbols=AAPL,GOOG,UNH
//
// Returns: { items: [ { src, title, url, time, ts } ] }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36'

function decode(s) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

function parseItems(xml, sym) {
  const out = []
  const blocks = xml.split('<item>').slice(1)
  for (const b of blocks.slice(0, 4)) {
    const title = b.match(/<title>(.*?)<\/title>/s)?.[1]
    const link = b.match(/<link>(.*?)<\/link>/s)?.[1]
    const pub = b.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1]
    if (!title || !link) continue
    const ts = pub ? Date.parse(pub) : 0
    out.push({ src: sym, title: decode(title), url: decode(link), ts: Number.isNaN(ts) ? 0 : ts })
  }
  return out
}

async function fetchSym(sym) {
  const url =
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`rss ${res.status}`)
  return parseItems(await res.text(), sym)
}

function relTime(ts) {
  if (!ts) return ''
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}M`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}H`
  return `${Math.round(hrs / 24)}D`
}

export default async function handler(req, res) {
  const raw = (req.query?.symbols || '').toString()
  const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 40)

  if (!symbols.length) {
    res.status(400).json({ error: 'symbols required' })
    return
  }

  const results = await Promise.all(
    symbols.map((s) => fetchSym(s).catch(() => []))
  )

  const seen = new Set()
  const items = results
    .flat()
    .filter((it) => (seen.has(it.title) ? false : seen.add(it.title)))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20)
    .map((it) => ({ ...it, time: relTime(it.ts) }))

  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600')
  res.status(200).json({ items, ts: Date.now() })
}
