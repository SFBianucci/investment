/**
 * indicators.js
 * Indicadores técnicos y scoring cuantitativo.
 */

// ── RSI ──────────────────────────────────────────────────────────

export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50

  const deltas = closes.slice(1).map((v, i) => v - closes[i])
  const gains = deltas.map(d => (d > 0 ? d : 0))
  const losses = deltas.map(d => (d < 0 ? -d : 0))

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2))
}

// ── EMA ──────────────────────────────────────────────────────────

function calcEMA(data, period) {
  const k = 2 / (period + 1)
  const ema = [data[0]]
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

// ── MACD ─────────────────────────────────────────────────────────

export function calcMACD(closes) {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' }

  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = calcEMA(macdLine, 9)
  const histogram = macdLine.map((v, i) => v - signalLine[i])

  const lastMACD = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]
  const lastHist = histogram[histogram.length - 1]

  return {
    macd: parseFloat(lastMACD.toFixed(4)),
    signal: parseFloat(lastSignal.toFixed(4)),
    histogram: parseFloat(lastHist.toFixed(4)),
    trend: lastMACD > lastSignal ? 'alcista' : 'bajista',
  }
}

// ── Bollinger Bands ───────────────────────────────────────────────

export function calcBollinger(closes, period = 20) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, pct_b: 0.5, position: 'normal' }

  const slice = closes.slice(-period)
  const sma = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((sum, v) => sum + (v - sma) ** 2, 0) / period
  const std = Math.sqrt(variance)

  const upper = sma + 2 * std
  const lower = sma - 2 * std
  const price = closes[closes.length - 1]
  const pctB = upper !== lower ? (price - lower) / (upper - lower) : 0.5

  return {
    upper: parseFloat(upper.toFixed(2)),
    middle: parseFloat(sma.toFixed(2)),
    lower: parseFloat(lower.toFixed(2)),
    pct_b: parseFloat(pctB.toFixed(3)),
    position: pctB > 0.9 ? 'sobrecomprado' : pctB < 0.1 ? 'sobrevendido' : 'normal',
  }
}

// ── SMA Cross ────────────────────────────────────────────────────

export function calcSMACross(closes) {
  const sma = (arr, n) => {
    if (arr.length < n) return null
    return arr.slice(-n).reduce((a, b) => a + b, 0) / n
  }

  const sma50 = sma(closes, 50)
  const sma200 = sma(closes, 200)

  return {
    sma_50: sma50 ? parseFloat(sma50.toFixed(2)) : null,
    sma_200: sma200 ? parseFloat(sma200.toFixed(2)) : null,
    cross: sma50 && sma200 ? (sma50 > sma200 ? 'golden_cross' : 'death_cross') : 'insufficient_data',
  }
}

// ── ATR ──────────────────────────────────────────────────────────

export function calcATR(highs, lows, closes, period = 14) {
  const tr = closes.slice(1).map((_, i) => {
    return Math.max(
      highs[i + 1] - lows[i + 1],
      Math.abs(highs[i + 1] - closes[i]),
      Math.abs(lows[i + 1] - closes[i])
    )
  })
  const slice = tr.slice(-period)
  return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(4))
}

// ── Volatility (annualized) ──────────────────────────────────────

export function calcVolatility(closes, period = 30) {
  const returns = closes.slice(1).map((v, i) => Math.log(v / closes[i]))
  const slice = returns.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  const variance = slice.reduce((sum, r) => sum + (r - mean) ** 2, 0) / slice.length
  return parseFloat((Math.sqrt(variance * 252) * 100).toFixed(2))
}

// ── Score cuantitativo (0–100) ───────────────────────────────────
/**
 * Framework de scoring inspirado en metodologías quant:
 *
 * Técnico    50%:  RSI (20pt) + MACD histogram (15pt) + Bollinger %B (15pt)
 * Fundamental 35%:  P/E (15pt) + Revenue Growth (10pt) + Profit Margin (10pt)
 * Momentum   15%:  Golden/Death Cross (15pt)
 */
export function computeSignalScore({ rsi, macdHist, pctB, smaCross, peRatio, revenueGrowth, profitMargin }) {
  let score = 0

  // RSI
  if (rsi >= 40 && rsi <= 65)      score += 20
  else if (rsi >= 30 || rsi <= 72) score += 12
  else if (rsi < 30)               score += 18  // sobrevendido = potencial rebote
  else                             score += 4   // sobrecomprado

  // MACD histogram
  score += macdHist > 0
    ? Math.min(15, 8 + macdHist * 100)
    : Math.max(0, 8 + macdHist * 100)

  // Bollinger %B
  if (pctB >= 0.2 && pctB <= 0.7) score += 15
  else if (pctB < 0.2)            score += 12
  else                            score += 5

  // P/E
  if (peRatio != null && peRatio > 0) {
    if (peRatio < 15)      score += 15
    else if (peRatio < 25) score += 12
    else if (peRatio < 35) score += 7
    else                   score += 3
  } else score += 8

  // Revenue Growth
  if (revenueGrowth != null) {
    if (revenueGrowth > 0.15)     score += 10
    else if (revenueGrowth > 0.05) score += 7
    else if (revenueGrowth > 0)    score += 4
    else                           score += 1
  } else score += 5

  // Profit Margin
  if (profitMargin != null) {
    if (profitMargin > 0.20)      score += 10
    else if (profitMargin > 0.10) score += 7
    else if (profitMargin > 0)    score += 4
    else                          score += 1
  } else score += 5

  // SMA Cross
  score += smaCross === 'golden_cross' ? 15 : 4

  score = Math.min(100, Math.max(0, score))

  let signal, signal_label
  if (score >= 78)      { signal = 'compra_fuerte'; signal_label = 'Compra fuerte' }
  else if (score >= 60) { signal = 'comprar';       signal_label = 'Comprar' }
  else if (score >= 42) { signal = 'mantener';      signal_label = 'Mantener' }
  else if (score >= 28) { signal = 'reducir';       signal_label = 'Reducir' }
  else                  { signal = 'vender';         signal_label = 'Vender' }

  return {
    score: parseFloat(score.toFixed(1)),
    signal,
    signal_label,
    breakdown: {
      tecnico: parseFloat(Math.min(50, score * 0.5).toFixed(1)),
      fundamental: parseFloat(Math.min(35, score * 0.35).toFixed(1)),
      momentum: parseFloat(Math.min(15, score * 0.15).toFixed(1)),
    },
  }
}

// ── YTM (bonos) ──────────────────────────────────────────────────

export function calcYTM(faceValue, price, couponRatePct, yearsToMaturity, frequency = 2) {
  if (yearsToMaturity <= 0 || price <= 0) return 0

  const coupon = faceValue * (couponRatePct / 100) / frequency
  const periods = Math.round(yearsToMaturity * frequency)

  const bondPrice = (ytmPeriod) => {
    const pvCoupons = Array.from({ length: periods }, (_, t) =>
      coupon / Math.pow(1 + ytmPeriod, t + 1)
    ).reduce((a, b) => a + b, 0)
    const pvFace = faceValue / Math.pow(1 + ytmPeriod, periods)
    return pvCoupons + pvFace
  }

  let ytmGuess = 0.05 / frequency
  for (let i = 0; i < 200; i++) {
    const p = bondPrice(ytmGuess)
    const pPlus = bondPrice(ytmGuess + 1e-5)
    const derivative = (pPlus - p) / 1e-5
    if (Math.abs(derivative) < 1e-10) break
    ytmGuess -= (p - price) / derivative
    ytmGuess = Math.max(ytmGuess, 1e-6)
  }

  return parseFloat((ytmGuess * frequency * 100).toFixed(2))
}
