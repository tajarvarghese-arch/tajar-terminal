import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, writeFile } from 'node:fs/promises'

function sitesWorker() {
  return {
    name: 'sites-worker',
    async closeBundle() {
      await mkdir('dist/server', { recursive: true })
      await writeFile('dist/server/index.js', `
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404) return response

    const url = new URL(request.url)
    url.pathname = '/index.html'
    return env.ASSETS.fetch(new Request(url, request))
  }
}
`.trimStart())
    }
  }
}

export default defineConfig({
  plugins: [react(), sitesWorker()],
  server: {
    open: false,
    port: 3000,
    https: false
  }
})
