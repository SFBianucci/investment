/**
 * portfolio.js
 * Definición del portfolio + lógica de valorización.
 *
 * ⚠️  Editar PORTFOLIO con tus datos reales.
 */

import { analyzeTicker } from './yahoo.js'
import { getFX, getCCLRate } from './fx.js'
import { calcYTM } from './indicators.js'

// ─────────────────────────────────────────────────────────────────
// TU PORTFOLIO — editá estos datos
// ─────────────────────────────────────────────────────────────────

export const PORTFOLIO = {
  cedears: [
    { ticker: 'AAPL',  sector: 'Tecnología',           qty: 28,      avgPriceARS: 18410  },
    { ticker: 'GLD',   sector: 'Commodities / Oro',    qty: 137,     avgPriceARS: 13570  },
    { ticker: 'GOOGL', sector: 'Tecnología',           qty: 36,      avgPriceARS: 7695   },
    { ticker: 'HMY',   sector: 'Minería',              qty: 22,      avgPriceARS: 22170  },
    { ticker: 'KO',    sector: 'Consumo Masivo',       qty: 17,      avgPriceARS: 22760  },
    { ticker: 'MELI',  sector: 'Tecnología',           qty: 13,      avgPriceARS: 20440  },
    { ticker: 'META',  sector: 'Tecnología',           qty: 11,      avgPriceARS: 37600  },
    { ticker: 'NVDA',  sector: 'IA / Chips',           qty: 42,      avgPriceARS: 11070  },
    { ticker: 'TSLA',  sector: 'Vehículos Eléctricos', qty: 10,      avgPriceARS: 37900  },
    { ticker: 'UNP',   sector: 'Transporte',           qty: 8,       avgPriceARS: 17770  },
  ],
  bonos: [
    { ticker: 'AL30',  name: 'Bono USD Step Up 2030', tipo: 'Soberano USD', qty: 909,    avgPrice: 86600,   vto: '2030-07-09', cuponPct: 3.875 },
    { ticker: 'AL35',  name: 'Bono USD Step Up 2035', tipo: 'Soberano USD', qty: 713,    avgPrice: 106190,  vto: '2035-07-09', cuponPct: 3.625 },
    { ticker: 'S29Y6', name: 'LECAP VTO 29/05/26',    tipo: 'Pesos LECAP', qty: 821309, avgPrice: 124.65,  vto: '2026-05-29', cuponPct: 0     },
    { ticker: 'TX26',  name: 'BONTE CER 2% 2026',     tipo: 'Pesos CER',   qty: 406815, avgPrice: 1275.50, vto: '2026-11-09', cuponPct: 2.0   },
  ],
  accionesARG: [
    { ticker: 'AUSO.BA', display: 'AUSO', name: 'Autopista del Sol',       sector: 'Infraestructura', qty: 77,   avgPriceARS: 3795  },
    { ticker: 'BYMA.BA', display: 'BYMA', name: 'Bolsas y Mercados ARG',   sector: 'Finanzas',        qty: 1048, avgPriceARS: 305   },
    { ticker: 'FIPL.BA', display: 'FIPL', name: 'Fiplasto',                sector: 'Industrial',      qty: 617,  avgPriceARS: 186   },
    { ticker: 'GGAL.BA', display: 'GGAL', name: 'Grupo Financiero Galicia',sector: 'Finanzas',        qty: 70,   avgPriceARS: 6060  },
    { ticker: 'HAVA.BA', display: 'HAVA', name: 'Havanna Holding',         sector: 'Consumo',         qty: 23,   avgPriceARS: 5570  },
    { ticker: 'METR.BA', display: 'METR', name: 'Metrogas',                sector: 'Energía',         qty: 140,  avgPriceARS: 1940  },
    { ticker: 'PAMP.BA', display: 'PAMP', name: 'Pampa Energía',           sector: 'Energía',         qty: 133,  avgPriceARS: 4745  },
    { ticker: 'YPFD.BA', display: 'YPFD', name: 'YPF',                     sector: 'Energía',         qty: 28,   avgPriceARS: 56200 },
  ],
  on: [
    { ticker: 'SNEBO', name: 'San Miguel ON XIII B Venc. 14/7/2029', cupon: '8% USD', qty: 99, avgPrice: 98100, vto: '2029-07-14' },
  ],
}

// ─────────────────────────────────────────────────────────────────

export async function getPortfolioSummary() {
  const [fx, cclRate] = await Promise.all([getFX(), getCCLRate()])

  // ── CEDEARs ──
  const cedearAssets = await Promise.all(
    PORTFOLIO.cedears.map(async (a) => {
      const data = await analyzeTicker(a.ticker)
      if (data.error) {
        return {
          ticker: a.ticker, sector: a.sector, qty: a.qty,
          price_usd: null, price_ars: a.avgPriceARS,
          avg_price_ars: a.avgPriceARS,
          total_ars: a.avgPriceARS * a.qty,
          cost_ars: a.avgPriceARS * a.qty,
          pnl_pct: 0,
          signal: { signal: 'mantener', signal_label: 'Mantener', score: 50 },
          rsi: 50, macd_trend: 'neutral', error: data.error,
        }
      }
      const priceARS = parseFloat((data.price * cclRate).toFixed(0))
      const totalARS = priceARS * a.qty
      return {
        ticker: a.ticker,
        sector: a.sector,
        qty: a.qty,
        price_usd: data.price,
        price_ars: priceARS,
        avg_price_ars: a.avgPriceARS,
        total_ars: totalARS,
        cost_ars: a.avgPriceARS * a.qty,
        pnl_pct: parseFloat(((priceARS / a.avgPriceARS - 1) * 100).toFixed(2)),
        signal: data.signal,
        rsi: data.indicators.rsi,
        macd_trend: data.indicators.macd.trend,
        change_7d_pct: data.change_7d_pct,
        change_30d_pct: data.change_30d_pct,
        fundamentals: data.fundamentals,
      }
    })
  )

  const cedearTotal = cedearAssets.reduce((s, a) => s + (a.total_ars || 0), 0)

  // ── Bonos ──
  const bonoAssets = PORTFOLIO.bonos.map((b) => {
    const total = b.qty * b.avgPrice
    const vto = new Date(b.vto)
    const yearsLeft = (vto - Date.now()) / (365.25 * 24 * 3600 * 1000)
    const ytm = b.tipo === 'Soberano USD' && yearsLeft > 0
      ? calcYTM(100, b.avgPrice / 100 * 100, b.cuponPct, yearsLeft)
      : null
    return {
      ...b,
      avg_price: b.avgPrice,
      total: parseFloat(total.toFixed(2)),
      years_to_maturity: parseFloat(yearsLeft.toFixed(2)),
      ytm_pct: ytm,
      signal: ytm && ytm > 7 ? 'comprar' : 'mantener',
    }
  })

  const bonosTotal = bonoAssets.reduce((s, b) => s + b.total, 0)

  // ── Acciones ARG ──
  const accAssets = await Promise.all(
    PORTFOLIO.accionesARG.map(async (a) => {
      const data = await analyzeTicker(a.ticker)
      if (data.error) {
        return {
          ticker: a.display, name: a.name, sector: a.sector, qty: a.qty,
          price: a.avgPriceARS, avg_price_ars: a.avgPriceARS,
          total_ars: a.avgPriceARS * a.qty, pnl_pct: 0,
          signal: { signal: 'mantener', signal_label: 'Mantener', score: 50 },
          rsi: 50, error: data.error,
        }
      }
      const total = data.price * a.qty
      return {
        ticker: a.display,
        name: a.name,
        sector: a.sector,
        qty: a.qty,
        price: parseFloat(data.price.toFixed(2)),
        avg_price_ars: a.avgPriceARS,
        total_ars: parseFloat(total.toFixed(2)),
        pnl_pct: parseFloat(((data.price / a.avgPriceARS - 1) * 100).toFixed(2)),
        signal: data.signal,
        rsi: data.indicators.rsi,
        change_7d_pct: data.change_7d_pct,
        change_30d_pct: data.change_30d_pct,
        fundamentals: data.fundamentals,
      }
    })
  )

  const accTotal = accAssets.reduce((s, a) => s + (a.total_ars || 0), 0)

  // ── ON ──
  const onTotal = PORTFOLIO.on.reduce((s, o) => s + o.qty * o.avgPrice, 0)

  const grandTotal = cedearTotal + bonosTotal + accTotal + onTotal

  return {
    grand_total_ars: parseFloat(grandTotal.toFixed(0)),
    fx,
    ccl_rate: cclRate,
    sections: {
      cedears:      { assets: cedearAssets, total_ars: parseFloat(cedearTotal.toFixed(0)) },
      bonos:        { assets: bonoAssets,   total_ars: parseFloat(bonosTotal.toFixed(0)) },
      acciones_arg: { assets: accAssets,    total_ars: parseFloat(accTotal.toFixed(0)) },
      on:           { assets: PORTFOLIO.on, total_ars: parseFloat(onTotal.toFixed(0)) },
    },
    updated_at: new Date().toISOString(),
  }
}
