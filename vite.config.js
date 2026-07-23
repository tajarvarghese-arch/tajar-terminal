import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, writeFile } from 'node:fs/promises'

function sitesWorker() {
  return {
    name: 'sites-worker',
    async closeBundle() {
      await mkdir('dist/server', { recursive: true })
      await writeFile('dist/server/index.js', `
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'

function getSymbols(url) {
  return (url.searchParams.get('symbols') || '')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40)
}

function json(data, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache }
  })
}

async function quoteResponse(url) {
  const symbols = getSymbols(url)
  if (!symbols.length) return json({ error: 'symbols required' }, 400)

  const quotes = {}
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const endpoint = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=1d'
      const response = await fetch(endpoint, { headers: { 'user-agent': UA, accept: 'application/json' } })
      if (!response.ok) return
      const payload = await response.json()
      const meta = payload && payload.chart && payload.chart.result && payload.chart.result[0] && payload.chart.result[0].meta
      if (!meta) return
      quotes[symbol] = {
        price: typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : null,
        prevClose: typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : meta.previousClose
      }
    } catch { /* client keeps the last known value */ }
  }))

  return json({ quotes, ts: Date.now() }, 200, 'public, max-age=10, stale-while-revalidate=30')
}

function decodeXml(value) {
  return value
    .replace(/<!\\[CDATA\\[(.*?)\\]\\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()
}

function parseNews(xml, symbol) {
  return xml.split('<item>').slice(1, 5).flatMap((block) => {
    const title = block.match(/<title>(.*?)<\\/title>/s)
    const link = block.match(/<link>(.*?)<\\/link>/s)
    const published = block.match(/<pubDate>(.*?)<\\/pubDate>/s)
    if (!title || !link) return []
    const ts = published ? Date.parse(published[1]) : 0
    return [{ src: symbol, title: decodeXml(title[1]), url: decodeXml(link[1]), ts: Number.isNaN(ts) ? 0 : ts }]
  })
}

function relativeTime(ts) {
  if (!ts) return ''
  const minutes = Math.round((Date.now() - ts) / 60000)
  if (minutes < 60) return Math.max(1, minutes) + 'M'
  const hours = Math.round(minutes / 60)
  return hours < 24 ? hours + 'H' : Math.round(hours / 24) + 'D'
}

async function newsResponse(url) {
  const symbols = getSymbols(url)
  if (!symbols.length) return json({ error: 'symbols required' }, 400)

  const batches = await Promise.all(symbols.map(async (symbol) => {
    try {
      const endpoint = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=' + encodeURIComponent(symbol) + '&region=US&lang=en-US'
      const response = await fetch(endpoint, { headers: { 'user-agent': UA } })
      if (!response.ok) return []
      return parseNews(await response.text(), symbol)
    } catch { return [] }
  }))

  const seen = new Set()
  const items = batches.flat()
    .filter((item) => seen.has(item.title) ? false : (seen.add(item.title), true))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20)
    .map((item) => ({ ...item, time: relativeTime(item.ts) }))

  return json({ items, ts: Date.now() }, 200, 'public, max-age=180, stale-while-revalidate=600')
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url)
    if (requestUrl.pathname === '/api/quote') return quoteResponse(requestUrl)
    if (requestUrl.pathname === '/api/news') return newsResponse(requestUrl)

    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404) return response

    requestUrl.pathname = '/index.html'
    return env.ASSETS.fetch(new Request(requestUrl, request))
  }
}
`.trimStart())
    }
  }
}

const buildId = Date.now().toString(36)

function versionFile() {
  return {
    name: 'version-file',
    async closeBundle() {
      await mkdir('dist', { recursive: true })
      await writeFile('dist/version.json', JSON.stringify({ build: buildId }))
    }
  }
}

export default defineConfig({
  plugins: [react(), sitesWorker(), versionFile()],
  define: {
    __BUILD__: JSON.stringify(buildId)
  },
  server: {
    open: false,
    port: 3000,
    https: false
  }
})
