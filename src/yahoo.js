/**
 * yahoo.js
 * Wrapper sobre endpoints publicos de Yahoo Finance via fetch.
 */

import { cache } from './cache.js'
import { calcRSI, calcMACD, calcBollinger, calcSMACross, calcATR, calcVolatility, computeSignalScore } from './indicators.js'

function mapPeriodToRange(period) {
  if (period === '6mo') return '6mo'
  if (period === '3mo') return '3mo'
  if (period === '1mo') return '1mo'
  return '1y'
}

async function fetchChart(ticker, period) {
  const range = mapPeriodToRange(period)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d&events=div%2Csplits`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Yahoo chart HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return null

  const timestamps = result.timestamp || []
  const quote = result?.indicators?.quote?.[0] || {}
  const closes = quote.close || []
  const highs = quote.high || []
  const lows = quote.low || []

  const rows = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    const high = highs[i]
    const low = lows[i]
    if (close == null || high == null || low == null) continue
    rows.push({
      date: new Date(timestamps[i] * 1000),
      close: Number(close),
      high: Number(high),
      low: Number(low),
    })
  }

  return {
    historical: rows,
    meta: result.meta || {},
  }
}

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Yahoo quote HTTP ${res.status}`)
  const json = await res.json()
  return json?.quoteResponse?.result?.[0] || null
}

/**
 * Analiza un ticker completo: técnico + fundamental + señal.
 */
export async function analyzeTicker(ticker, period = '1y') {
  const cacheKey = `analyze_${ticker}_${period}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  try {
    const chartData = await fetchChart(ticker, period)
    const historical = chartData?.historical || []

    if (!historical || historical.length < 30) {
      return { error: `Sin datos suficientes para ${ticker}`, ticker }
    }

    const closes = historical.map(d => d.close)
    const highs   = historical.map(d => d.high)
    const lows    = historical.map(d => d.low)

    const currentPrice = closes[closes.length - 1]
    const price7d  = closes[Math.max(0, closes.length - 7)]
    const price30d = closes[Math.max(0, closes.length - 30)]

    // Indicadores técnicos
    const rsi   = calcRSI(closes)
    const macd  = calcMACD(closes)
    const boll  = calcBollinger(closes)
    const sma   = calcSMACross(closes)
    const atr   = calcATR(highs, lows, closes)
    const vol30 = calcVolatility(closes)

    // Fundamentales basicos via quote
    let fundamentals = {}
    try {
      const quote = await fetchQuote(ticker)
      if (quote) {
        const analystTarget = quote.targetMeanPrice ?? null
        const pe = quote.trailingPE ?? quote.forwardPE ?? null

        fundamentals = {
          pe_ratio: pe,
          eps: quote.epsTrailingTwelveMonths ?? null,
          revenue_growth_pct: null,
          profit_margin_pct: null,
          dividend_yield_pct: quote.trailingAnnualDividendYield
            ? parseFloat((quote.trailingAnnualDividendYield * 100).toFixed(2))
            : null,
          beta: quote.beta ?? null,
          market_cap_bn: quote.marketCap ? parseFloat((quote.marketCap / 1e9).toFixed(1)) : null,
          analyst_target: analystTarget,
          analyst_rec: null,
          upside_pct: analystTarget
            ? parseFloat(((analystTarget / currentPrice - 1) * 100).toFixed(1))
            : null,
          sector: quote.sector || '',
          industry: quote.industry || '',
        }
      }
    } catch (_) {
      // fundamentales opcionales - continuar sin ellos
    }

    // Score compuesto
    const signal = computeSignalScore({
      rsi,
      macdHist:      macd.histogram,
      pctB:          boll.pct_b,
      smaCross:      sma.cross,
      peRatio:       fundamentals.pe_ratio,
      revenueGrowth: fundamentals.revenue_growth_pct != null ? fundamentals.revenue_growth_pct / 100 : null,
      profitMargin:  fundamentals.profit_margin_pct  != null ? fundamentals.profit_margin_pct  / 100 : null,
    })

    const result = {
      ticker,
      price:          parseFloat(currentPrice.toFixed(2)),
      currency:       'USD',
      change_7d_pct:  parseFloat(((currentPrice / price7d  - 1) * 100).toFixed(2)),
      change_30d_pct: parseFloat(((currentPrice / price30d - 1) * 100).toFixed(2)),
      indicators: { rsi, macd, bollinger: boll, sma, atr, volatility_30d: vol30 },
      fundamentals,
      signal,
      history_30d:    closes.slice(-30).map(p => parseFloat(p.toFixed(2))),
      history_dates:  historical.slice(-30).map(d => d.date.toISOString().split('T')[0]),
      timestamp:      new Date().toISOString(),
    }

    cache.set(cacheKey, result)
    return result

  } catch (err) {
    console.error(`Error analizando ${ticker}:`, err.message)
    return { error: err.message, ticker }
  }
}
