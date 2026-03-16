/**
 * Cache simple en memoria con TTL.
 * TTL default: 5 minutos.
 */

const TTL_MS = 5 * 60 * 1000

class MemoryCache {
  constructor() {
    this._store = new Map()
  }

  get(key) {
    const entry = this._store.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > TTL_MS) {
      this._store.delete(key)
      return null
    }
    return entry.value
  }

  set(key, value) {
    this._store.set(key, { value, ts: Date.now() })
  }

  clear() {
    this._store.clear()
  }
}

export const cache = new MemoryCache()
