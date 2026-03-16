/**
 * yahoo.js
 * Wrapper sobre yahoo-finance2 para obtener histórico y fundamentales.
 */

import yahooFinance from 'yahoo-finance2'
import { cache } from './cache.js'
import { calcRSI, calcMACD, calcBollinger, calcSMACross, calcATR, calcVolatility, computeSignalScore } from './indicators.js'

yahooFinance.setGlobalConfig({ validation: { logErrors: false } })

/**
 * Analiza un ticker completo: técnico + fundamental + señal.
 */
export async function analyzeTicker(ticker, period = '1y') {
  const cacheKey = `analyze_${ticker}_${period}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  try {
    // Histórico OHLCV
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - (period === '6mo' ? 0 : 1))
    if (period === '6mo') startDate.setMonth(startDate.getMonth() - 6)

    const historical = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    })

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

    // Fundamentales vía quote
    let fundamentals = {}
    try {
      const quote = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'price'],
      })

      const fd = quote.financialData || {}
      const sd = quote.summaryDetail || {}
      const ks = quote.defaultKeyStatistics || {}
      const pr = quote.price || {}

      fundamentals = {
        pe_ratio:            sd.trailingPE     ?? ks.forwardPE ?? null,
        eps:                 ks.trailingEps    ?? null,
        revenue_growth_pct:  fd.revenueGrowth  ? parseFloat((fd.revenueGrowth * 100).toFixed(2))  : null,
        profit_margin_pct:   fd.profitMargins  ? parseFloat((fd.profitMargins  * 100).toFixed(2))  : null,
        dividend_yield_pct:  sd.dividendYield  ? parseFloat((sd.dividendYield  * 100).toFixed(2))  : null,
        beta:                sd.beta           ?? null,
        market_cap_bn:       pr.marketCap      ? parseFloat((pr.marketCap / 1e9).toFixed(1))       : null,
        analyst_target:      fd.targetMeanPrice ?? null,
        analyst_rec:         fd.recommendationKey?.toUpperCase() ?? null,
        upside_pct:          fd.targetMeanPrice
          ? parseFloat(((fd.targetMeanPrice / currentPrice - 1) * 100).toFixed(1))
          : null,
        sector:   pr.sector   ?? quote.summaryProfile?.sector   ?? '',
        industry: pr.industry ?? quote.summaryProfile?.industry ?? '',
      }
    } catch (_) {
      // fundamentales opcionales — continuar sin ellos
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
