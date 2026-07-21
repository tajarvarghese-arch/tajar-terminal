# TAJAR TERMINAL

A personal life terminal in a brutalist Bloomberg skin. Consolas, amber on black, hairline grid.

Modules: wire tape (weather / movers / headlines), today's focus + schedule + must-dos, live Greenwich weather, week ahead, horizon goals with T-minus countdowns, 28-day streak heatmap, captain's log, daily grounding, and the equity book collapsed to a strip.

- Vite + React, deployed on Vercel
- Live quotes and holdings headlines via keyless serverless proxies (`api/quote.js`, `api/news.js`)
- Weather via Open-Meteo, direct from the browser
- All personal state is localStorage-only — private to each device

```
npm install
npm run dev
```
