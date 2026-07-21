// Vercel serverless function — live quote proxy.
// Proxies Yahoo Finance (no API key) so the browser can pull real prices
// without CORS issues. GET /api/quote?symbols=AAPL,GOOG,UNH
//
// Returns: { quotes: { AAPL: { price, prevClose }, ... } }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36'

async function fetchOne(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=1d`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`yahoo ${res.status}`)
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta) throw new Error('no meta')
  const price =
    typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : null
  const prevClose =
    typeof meta.chartPreviousClose === 'number'
      ? meta.chartPreviousClose
      : typeof meta.previousClose === 'number'
        ? meta.previousClose
        : null
  return { price, prevClose }
}

export default async function handler(req, res) {
  const raw = (req.query?.symbols || '').toString()
  const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 40)

  if (!symbols.length) {
    res.status(400).json({ error: 'symbols required' })
    return
  }

  const quotes = {}
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        quotes[sym] = await fetchOne(sym)
      } catch {
        // omit failed symbols; client keeps its last-known value
      }
    })
  )

  // cache at the edge for 10s to stay well under Yahoo rate limits
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30')
  res.status(200).json({ quotes, ts: Date.now() })
}
