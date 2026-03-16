/**
 * Portfolio Tracker — Backend Node.js
 * =====================================
 * Express API con datos reales via Yahoo Finance + análisis cuantitativo.
 *
 * Instalación:
 *   npm install
 *
 * Uso:
 *   npm run dev     ← con hot reload (nodemon)
 *   npm start       ← producción
 *
 * API Docs: http://localhost:3000
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPortfolioSummary } from './portfolio.js'
import { getFX } from './fx.js'
import { analyzeTicker } from './analysis.js'
import { getSP500List, getSP500Sectors, getSP500Top } from './sp500.js'
import { cache } from './cache.js'

const app = express()
const PORT = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors())
app.use(express.json())

// Permite que la misma app funcione tanto en local (/fx) como en Vercel (/api/fx)
app.use((req, _res, next) => {
  if (req.url === '/api') req.url = '/'
  else if (req.url.startsWith('/api/')) req.url = req.url.slice(4)
  next()
})

app.use(express.static(path.resolve(__dirname, '../frontend')))

// ── Health ──────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Portfolio Tracker API v1.0 (Node.js)',
    endpoints: [
      'GET /fx',
      'GET /portfolio/summary',
      'GET /portfolio/signals',
      'GET /analyze/:ticker',
      'GET /sp500',
      'GET /sp500/sectors',
      'GET /sp500/top?n=20&order=gainers',
      'GET /cache/clear',
    ],
  })
})

// ── FX ──────────────────────────────────────────────────────────

app.get('/fx', async (req, res) => {
  try {
    const data = await getFX()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Portfolio ────────────────────────────────────────────────────

app.get('/portfolio/summary', async (req, res) => {
  try {
    const data = await getPortfolioSummary()
    res.json(data)
  } catch (err) {
    console.error('Portfolio summary error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/portfolio/signals', async (req, res) => {
  try {
    const summary = await getPortfolioSummary()
    const signals = []

    for (const asset of summary.sections.cedears.assets) {
      signals.push({
        ticker: asset.ticker,
        type: 'CEDEAR',
        signal: asset.signal?.signal,
        signal_label: asset.signal?.signal_label,
        score: asset.signal?.score,
        rsi: asset.rsi,
      })
    }
    for (const asset of summary.sections.acciones_arg.assets) {
      signals.push({
        ticker: asset.ticker,
        type: 'Acción ARG',
        signal: asset.signal?.signal,
        signal_label: asset.signal?.signal_label,
        score: asset.signal?.score,
        rsi: asset.rsi,
      })
    }

    signals.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    res.json({ signals, count: signals.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Analyze ──────────────────────────────────────────────────────

app.get('/analyze/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase()
    const period = req.query.period || '1y'
    const data = await analyzeTicker(ticker, period)
    if (data.error) return res.status(404).json(data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── S&P 500 ──────────────────────────────────────────────────────

app.get('/sp500', async (req, res) => {
  try {
    const data = await getSP500List()
    res.json({ count: data.length, data })
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
})

app.get('/sp500/sectors', async (req, res) => {
  try {
    const data = await getSP500Sectors()
    res.json({ sectors: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/sp500/top', async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 20
    const order = req.query.order || 'gainers'
    const data = await getSP500Top(n, order)
    res.json({ order, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/sp500/analyze/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase()
    const data = await analyzeTicker(ticker)
    if (data.error) return res.status(404).json(data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Cache ────────────────────────────────────────────────────────

app.get('/cache/clear', (req, res) => {
  cache.clear()
  res.json({ status: 'cleared', message: 'Cache limpiado. Próximas requests obtendrán datos frescos.' })
})

// ── Start ────────────────────────────────────────────────────────

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\n🚀  Portfolio Tracker API corriendo en http://localhost:${PORT}`)
    console.log(`📄  Endpoints disponibles en http://localhost:${PORT}\n`)
  })
}

export default app
