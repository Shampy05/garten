const TTL = 30_000

function key(userId) {
  return `garten_data_${userId}`
}

export function getCached(userId) {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL) {
      localStorage.removeItem(key(userId))
      return null
    }
    return data
  } catch {
    return null
  }
}

export function setCache(userId, data) {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ data, ts: Date.now() }))
  } catch {
  }
}

export function clearCache(userId) {
  try {
    localStorage.removeItem(key(userId))
  } catch {
  }
}
