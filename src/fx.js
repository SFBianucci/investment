/**
 * fx.js
 * Cotizaciones del dólar en Argentina via dolarapi.com
 */

import { cache } from './cache.js'

export async function getFX() {
  const cached = cache.get('usd_ars')
  if (cached) return cached

  const result = { oficial: null, blue: null, mep: null, ccl: null }

  try {
    const res = await fetch('https://dolarapi.com/v1/dolares', {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const items = await res.json()

    for (const item of items) {
      const nombre = (item.nombre || '').toLowerCase()
      const entry = { compra: item.compra, venta: item.venta }
      if (nombre.includes('oficial'))                result.oficial = entry
      else if (nombre.includes('blue'))              result.blue    = entry
      else if (nombre.includes('bolsa') || nombre.includes('mep')) result.mep = entry
      else if (nombre.includes('contado') || nombre.includes('ccl')) result.ccl = entry
    }
  } catch (err) {
    console.warn('Error obteniendo FX:', err.message)
  }

  cache.set('usd_ars', result)
  return result
}

/**
 * Devuelve la tasa CCL (venta) o fallback.
 */
export async function getCCLRate() {
  const fx = await getFX()
  return fx?.ccl?.venta ?? fx?.mep?.venta ?? 1270
}
