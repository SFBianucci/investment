/**
 * sp500.js
 * Lista del S&P 500 con precios y agrupación por sector.
 * Usa yahoo-finance2 para batch quotes.
 */

import yahooFinanceModule from 'yahoo-finance2'
import { cache } from './cache.js'

const yahooFinance = yahooFinanceModule?.default ?? yahooFinanceModule

// ── Lista estática del S&P 500 con sectores ──────────────────────
// Fuente: Wikipedia S&P 500 components (actualizada periódicamente)
// Para mantener la lista fresca, podés hacer fetch a Wikipedia.

async function fetchSP500Components() {
  const cached = cache.get('sp500_components')
  if (cached) return cached

  try {
    const res = await fetch(
      'https://en.wikipedia.org/w/api.php?action=parse&page=List_of_S%26P_500_companies&prop=wikitext&format=json&origin=*',
      { signal: AbortSignal.timeout(10000) }
    )
    const json = await res.json()
    const wikitext = json?.parse?.wikitext?.['*'] || ''

    // Parse la tabla de Wikipedia (formato wikitext)
    const rows = wikitext.split('\n|-').slice(1)
    const components = []

    for (const row of rows) {
      const cells = row.split('\n|').map(c => c.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').replace(/[{}']/g, '').trim())
      if (cells.length < 4) continue
      const ticker = cells[1]?.split('\n')[0]?.trim()
      const name   = cells[2]?.split('\n')[0]?.trim()
      const sector = cells[3]?.split('\n')[0]?.trim()
      if (ticker && ticker.length <= 5 && name && sector) {
        components.push({ ticker: ticker.replace(/\./g, '-'), name, sector })
      }
    }

    if (components.length > 100) {
      cache.set('sp500_components', components)
      return components
    }
  } catch (err) {
    console.warn('Error obteniendo lista S&P 500 desde Wikipedia:', err.message)
  }

  // Fallback: lista compacta hardcodeada con los principales
  return FALLBACK_SP500
}

export async function getSP500List() {
  const cached = cache.get('sp500_quotes')
  if (cached) return cached

  const components = await fetchSP500Components()
  const tickers = components.map(c => c.ticker)

  // Yahoo Finance acepta batches de hasta 1500 tickers en spark
  const quotes = []
  const BATCH = 100
  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH)
    try {
      const results = await yahooFinance.quote(batch, {}, { validateResult: false })
      const arr = Array.isArray(results) ? results : [results]
      for (const q of arr) {
        if (!q || !q.symbol) continue
        const comp = components.find(c => c.ticker === q.symbol)
        quotes.push({
          ticker:         q.symbol,
          name:           comp?.name || q.shortName || q.longName || q.symbol,
          sector:         comp?.sector || q.sector || 'Unknown',
          price:          parseFloat((q.regularMarketPrice ?? 0).toFixed(2)),
          change_1d_pct:  parseFloat((q.regularMarketChangePercent ?? 0).toFixed(2)),
          market_cap_bn:  q.marketCap ? parseFloat((q.marketCap / 1e9).toFixed(1)) : null,
        })
      }
    } catch (err) {
      console.warn(`Error batch S&P500 i=${i}:`, err.message)
    }
  }

  cache.set('sp500_quotes', quotes)
  return quotes
}

export async function getSP500Sectors() {
  const data = await getSP500List()
  const map = {}
  for (const item of data) {
    const s = item.sector || 'Unknown'
    if (!map[s]) map[s] = { sector: s, count: 0, avg_change_1d: 0, tickers: [] }
    map[s].count++
    map[s].avg_change_1d += item.change_1d_pct
    map[s].tickers.push(item)
  }
  return Object.values(map).map(s => ({
    ...s,
    avg_change_1d: parseFloat((s.avg_change_1d / s.count).toFixed(2)),
    tickers: s.tickers.sort((a, b) => b.change_1d_pct - a.change_1d_pct),
  }))
}

export async function getSP500Top(n = 20, order = 'gainers') {
  const data = await getSP500List()
  return [...data]
    .sort((a, b) => order === 'gainers'
      ? b.change_1d_pct - a.change_1d_pct
      : a.change_1d_pct - b.change_1d_pct
    )
    .slice(0, n)
}

// ── Fallback estático (los 50 más relevantes) ────────────────────

const FALLBACK_SP500 = [
  { ticker: 'AAPL',  name: 'Apple',                sector: 'Information Technology' },
  { ticker: 'MSFT',  name: 'Microsoft',            sector: 'Information Technology' },
  { ticker: 'NVDA',  name: 'NVIDIA',               sector: 'Information Technology' },
  { ticker: 'AMZN',  name: 'Amazon',               sector: 'Consumer Discretionary' },
  { ticker: 'META',  name: 'Meta Platforms',       sector: 'Communication Services'  },
  { ticker: 'GOOGL', name: 'Alphabet A',           sector: 'Communication Services'  },
  { ticker: 'TSLA',  name: 'Tesla',                sector: 'Consumer Discretionary'  },
  { ticker: 'BRK-B', name: 'Berkshire Hathaway',  sector: 'Financials'              },
  { ticker: 'JPM',   name: 'JPMorgan Chase',       sector: 'Financials'              },
  { ticker: 'V',     name: 'Visa',                 sector: 'Financials'              },
  { ticker: 'UNH',   name: 'UnitedHealth Group',  sector: 'Health Care'             },
  { ticker: 'XOM',   name: 'Exxon Mobil',         sector: 'Energy'                  },
  { ticker: 'LLY',   name: 'Eli Lilly',           sector: 'Health Care'             },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',   sector: 'Health Care'             },
  { ticker: 'MA',    name: 'Mastercard',          sector: 'Financials'              },
  { ticker: 'AVGO',  name: 'Broadcom',            sector: 'Information Technology'  },
  { ticker: 'PG',    name: 'Procter & Gamble',    sector: 'Consumer Staples'        },
  { ticker: 'HD',    name: 'Home Depot',          sector: 'Consumer Discretionary'  },
  { ticker: 'KO',    name: 'Coca-Cola',           sector: 'Consumer Staples'        },
  { ticker: 'ABBV',  name: 'AbbVie',              sector: 'Health Care'             },
  { ticker: 'MRK',   name: 'Merck',               sector: 'Health Care'             },
  { ticker: 'CVX',   name: 'Chevron',             sector: 'Energy'                  },
  { ticker: 'PEP',   name: 'PepsiCo',             sector: 'Consumer Staples'        },
  { ticker: 'CRM',   name: 'Salesforce',          sector: 'Information Technology'  },
  { ticker: 'COST',  name: 'Costco',              sector: 'Consumer Staples'        },
  { ticker: 'AMD',   name: 'Advanced Micro Devices', sector: 'Information Technology' },
  { ticker: 'NFLX',  name: 'Netflix',             sector: 'Communication Services'  },
  { ticker: 'TMO',   name: 'Thermo Fisher',       sector: 'Health Care'             },
  { ticker: 'ACN',   name: 'Accenture',           sector: 'Information Technology'  },
  { ticker: 'ADBE',  name: 'Adobe',               sector: 'Information Technology'  },
  { ticker: 'GE',    name: 'GE Aerospace',        sector: 'Industrials'             },
  { ticker: 'LIN',   name: 'Linde',               sector: 'Materials'               },
  { ticker: 'BAC',   name: 'Bank of America',     sector: 'Financials'              },
  { ticker: 'WFC',   name: 'Wells Fargo',         sector: 'Financials'              },
  { ticker: 'GS',    name: 'Goldman Sachs',       sector: 'Financials'              },
  { ticker: 'NEE',   name: 'NextEra Energy',      sector: 'Utilities'               },
  { ticker: 'UNP',   name: 'Union Pacific',       sector: 'Industrials'             },
  { ticker: 'INTC',  name: 'Intel',               sector: 'Information Technology'  },
  { ticker: 'QCOM',  name: 'Qualcomm',            sector: 'Information Technology'  },
  { ticker: 'INTU',  name: 'Intuit',              sector: 'Information Technology'  },
  { ticker: 'RTX',   name: 'RTX Corporation',     sector: 'Industrials'             },
  { ticker: 'HON',   name: 'Honeywell',           sector: 'Industrials'             },
  { ticker: 'CAT',   name: 'Caterpillar',         sector: 'Industrials'             },
  { ticker: 'AMGN',  name: 'Amgen',               sector: 'Health Care'             },
  { ticker: 'IBM',   name: 'IBM',                 sector: 'Information Technology'  },
  { ticker: 'GLD',   name: 'SPDR Gold Shares',    sector: 'Commodities'             },
  { ticker: 'MELI',  name: 'MercadoLibre',        sector: 'Consumer Discretionary'  },
  { ticker: 'HMY',   name: 'Harmony Gold Mining', sector: 'Materials'               },
  { ticker: 'WMT',   name: 'Walmart',             sector: 'Consumer Staples'        },
  { ticker: 'DIS',   name: 'Walt Disney',         sector: 'Communication Services'  },
]
