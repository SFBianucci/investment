import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPortfolioSummary } from './portfolio.js'
import { getFX } from './fx.js'
import { analyzeTicker } from './analysis.js'
import { getSP500List, getSP500Sectors, getSP500Top } from './sp500.js'
import { cache } from './cache.js'

export function createApp(options = {}) {
  const { serveStatic = true } = options
  const app = express()

  app.use(cors())
  app.use(express.json())

  if (serveStatic) {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    app.use(express.static(path.resolve(__dirname, '../frontend')))
  }

  app.get('/', (_req, res) => {
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

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'portfolio-tracker',
      runtime: process.version,
      vercel: process.env.VERCEL === '1',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      ts: new Date().toISOString(),
    })
  })

  app.get('/fx', async (_req, res) => {
    try {
      const data = await getFX()
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/portfolio/summary', async (_req, res) => {
    try {
      const data = await getPortfolioSummary()
      res.json(data)
    } catch (err) {
      console.error('Portfolio summary error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/portfolio/signals', async (_req, res) => {
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
          type: 'Accion ARG',
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

  app.get('/sp500', async (_req, res) => {
    try {
      const data = await getSP500List()
      res.json({ count: data.length, data })
    } catch (err) {
      res.status(503).json({ error: err.message })
    }
  })

  app.get('/sp500/sectors', async (_req, res) => {
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

  app.get('/cache/clear', (_req, res) => {
    cache.clear()
    res.json({ status: 'cleared', message: 'Cache limpiado. Proximas requests obtendran datos frescos.' })
  })

  return app
}
