// Free dictionary lookup backed by Wiktionary's REST API. Wiktionary is the
// only free, multilingual, no-key, no-quota option that fits Garten's
// learner audience — it covers all 25 reading languages in bookLanguages.js
// (and many more), returns native language definitions grouped by part of
// speech, and is CORS-friendly for the browser.
//
// We always hit the **English Wiktionary** endpoint. The English Wiktionary
// is unique among Wiktionary editions in that it cross-defines words from
// every other language it covers with an English-language gloss, which is
// exactly what a learner wants: "what does 'gehen' mean in English?". The
// <lang>.wiktionary.org endpoints return definitions in the word's own
// language (e.g. German for 'gehen') which is useless when the user is
// still learning.
//
// No caching layer for now — the user only clicks Lookup once per word, so
// the network call cost is trivial and stale data isn't a concern (we
// always show the user what we got so they can correct it).

const ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition'
const TIMEOUT_MS = 6000

// Build the request URL. Pure: testable without a network round-trip.
//
// `term` is whatever the user typed — we don't URL-encode here, callers can
// pre-encode if they need to (the browser fetch() handles this for us).
export function lookupUrl(term) {
  if (!term) return null
  // Wiktionary wants a normal URL-encoded path. encodeURIComponent escapes
  // everything but the slashes; we also collapse internal whitespace to
  // underscores (Wiktionary convention for multi-word entries like
  // "give up" → "give_up").
  const path = encodeURIComponent(String(term).trim().replace(/\s+/g, '_'))
  if (!path) return null
  return `${ENDPOINT}/${path}`
}

// Pure response normalizer: take the raw Wiktionary JSON and flatten it to
// a single list of { partOfSpeech, definition } pairs, dropping entries
// with no definition text. Wiktionary's shape is
//   { <langName>: [ { partOfSpeech, definitions: [{definition, ...}] } ] }
// where <langName> is "German", "French", etc. — one key per language the
// entry belongs to. We keep every language block (a word can be a German
// noun AND a French verb, for example) and let the UI group or filter.
export function normalizeDefinitions(json) {
  if (!json || typeof json !== 'object') return []
  const out = []
  for (const [language, senses] of Object.entries(json)) {
    if (!Array.isArray(senses)) continue
    for (const sense of senses) {
      const pos = sense?.partOfSpeech || ''
      const defs = Array.isArray(sense?.definitions) ? sense.definitions : []
      for (const d of defs) {
        const text = typeof d === 'string' ? d : d?.definition
        if (typeof text === 'string' && text.trim()) {
          out.push({ language, partOfSpeech: pos, definition: text.trim() })
        }
      }
    }
  }
  return out
}

// First non-empty definition string — what the UI auto-fills into the
// meaning field. The user can always edit it; we just pick the simplest
// "best guess" for one-tap fill.
export function firstDefinition(json) {
  const all = normalizeDefinitions(json)
  return all[0]?.definition || ''
}

// All definitions as flat strings (for surfacing alternatives in a list).
export function allDefinitions(json) {
  return normalizeDefinitions(json).map((d) => d.definition)
}

// Network call. Returns { ok: true, definitions: string[], error: null } on
// success, { ok: false, definitions: [], error: string } on any failure —
// the modal's "no result" UI consumes `error` and the user can still type
// the meaning by hand.
export async function lookupWord(term, { signal, fetch: fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const url = lookupUrl(term)
  if (!url) return { ok: false, definitions: [], error: 'No term' }
  const timeout = new AbortController()
  const onAbort = () => timeout.abort()
  if (signal) signal.addEventListener('abort', onAbort)
  const timer = setTimeout(() => timeout.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: timeout.signal,
    })
    if (res.status === 404) {
      return { ok: false, definitions: [], error: 'No entry' }
    }
    if (!res.ok) {
      return { ok: false, definitions: [], error: `HTTP ${res.status}` }
    }
    const json = await res.json()
    const defs = allDefinitions(json)
    if (!defs.length) return { ok: false, definitions: [], error: 'No definitions' }
    return { ok: true, definitions: defs, error: null }
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, definitions: [], error: 'Timed out' }
    return { ok: false, definitions: [], error: e?.message || 'Network error' }
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}