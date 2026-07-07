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
// Two endpoints, picked at runtime:
//
//   1. /api/rest_v1/page/definition/<term> — primary. Returns clean JSON
//      for most entries. Some pages (typically inflections and reduplicated
//      forms) only render via Parsoid, so the REST endpoint returns HTML
//      for those. We detect that and fall through to (2).
//
//   2. /w/api.php?action=parse&page=<term>&prop=wikitext&format=json —
//      fallback. Returns the page wikitext, which we parse for the first
//      `# gloss` line under the target-language section. The wikitext is
//      plain text (no HTML) so it round-trips through fetch + JSON safely.
//
// No caching layer for now — the user only clicks Lookup once per word, so
// the network call cost is trivial and stale data isn't a concern (we
// always show the user what we got so they can correct it).

const REST_ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition'
const ACTION_ENDPOINT = 'https://en.wiktionary.org/w/api.php'
const TIMEOUT_MS = 6000

// Normal map: ISO 639-1 → English Wiktionary section name. Wiktionary uses
// the English name ("German", "French", "Mandarin", etc.) for its section
// headers; the same section name applies across words. Anything not in
// this map falls back to the bare ISO code (rare — covered by the curated
// reading-language set in bookLanguages.js).
const SECTION_NAME = {
  ar: 'Arabic',
  zh: 'Chinese',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  es: 'Spanish',
  sv: 'Swedish',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
}

// Build the primary REST request URL. Pure: testable without a network
// round-trip. `term` is whatever the user typed; the browser fetch() will
// URL-encode for us.
export function lookupUrl(term) {
  if (!term) return null
  const path = encodeURIComponent(String(term).trim().replace(/\s+/g, '_'))
  if (!path) return null
  return `${REST_ENDPOINT}/${path}`
}

// Build the fallback action API request URL. We pass the language code so
// the caller can hint at which section to read (the action API returns the
// whole page; the parser narrows to that section).
//
// MediaWiki's /w/api.php doesn't send CORS headers by default, but it
// honors the documented `origin=*` query parameter to add an
// `Access-Control-Allow-Origin: *` response header. We always include it
// so the URL works from the browser; it's a no-op for server-side callers
// and is the only way the action API can be reached directly from Garten's
// SPA without a CORS proxy.
export function actionApiUrl(term, languageCode = null) {
  if (!term) return null
  const title = encodeURIComponent(String(term).trim().replace(/\s+/g, '_'))
  if (!title) return null
  // wraplines=0 keeps the wikitext on one line so our regex doesn't have to
  // span newlines; format=json gives a structured response.
  const params = new URLSearchParams({
    action: 'parse',
    page: title.replace(/%20/g, '_'),
    prop: 'wikitext',
    format: 'json',
    wraplines: '0',
    origin: '*',
  })
  void languageCode
  return `${ACTION_ENDPOINT}?${params.toString()}`
}

// Pure response normalizer: take the raw Wiktionary JSON (from the REST
// endpoint) and flatten it to a single list of { language, partOfSpeech,
// definition } pairs. Wiktionary's shape is
//   { <langName>: [ { partOfSpeech, definitions: [{definition, ...}] } ] }
// where <langName> is "German", "French", etc. — one key per language the
// entry belongs to.
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

// Strip MediaWiki templates {{...}} (possibly nested) and HTML tags from a
// wikitext line. We need a lightweight pass — the real parser is at MW
// itself, but a stack-based template strip plus a tag strip is enough to
// turn `{{inflection of|muskulös|...}}` and `<a href="...">strong</a>` into
// plain prose. Pure.
export function stripWikiMarkup(s) {
  if (typeof s !== 'string') return ''
  // Templates: match {{ ... }} with optional nested ones (single-pass for
  // nesting depth up to 3 is enough for typical glosses; deeper nesting
  // gets incrementally reduced by re-running the strip).
  let out = s
  for (let i = 0; i < 3; i++) {
    out = out.replace(/\{\{[^{}]*\}\}/g, ' ').replace(/\{\{[^{}]*\}\}/g, ' ')
    if (!out.includes('{{')) break
  }
  // HTML tags.
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
  // Triple-braced parser functions, [[link|display]] → display, [link] → link.
  out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  out = out.replace(/\[\[([^\]]+)\]\]/g, '$1')
  // Bold/italic markup.
  out = out.replace(/'''+/g, '')
  // Collapse whitespace and trailing punctuation noise.
  out = out.replace(/\s+/g, ' ').trim()
  return out
}

// Parse the action-API wikitext for definition lines under the target
// language section. Returns an array of { partOfSpeech, definition }.
//
// Wikitext layout (simplified):
//   ==Language==
//   ===Part of speech===
//   # first gloss
//   # second gloss
//   ===Another POS===
//   # more glosses
//   ==Next language==
//   ...
//
// We split on `==\n==` boundaries, take the section matching the language
// (case-insensitive; section headers are like `==German==`), then walk the
// lines and collect `# gloss` items. We drop glosses that came from
// inflection transclusions (the `stripWikiMarkup` collapses them to
// trivially short results that fall below MIN_DEFINITION_CHARS).
export function parseWikitextDefinitions(wikitext, languageCode) {
  if (typeof wikitext !== 'string' || !wikitext) return []
  const target = SECTION_NAME[languageCode] || (languageCode ? languageCode[0].toUpperCase() + languageCode.slice(1) : null)
  if (!target) return []

  // Find the section block. The first level-2 heading in the page is the
  // introductory section, so we look for `==Target==` on its own line
  // and walk until the next `==<something>==`.
  const lines = wikitext.split('\n')
  let inSection = false
  let currentPos = ''
  const out = []
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h2 = line.match(/^==\s*([^=].*?)\s*==$/)
    if (h2) {
      inSection = h2[1].trim().toLowerCase() === target.toLowerCase()
      currentPos = ''
      continue
    }
    if (!inSection) continue
    const h3 = line.match(/^===\s*([^=].*?)\s*===$/)
    if (h3) {
      currentPos = h3[1].trim()
      continue
    }
    // Definition lines start with `# ` (numbered list) and aren't part of
    // navboxes or tables (which use `|`, `!`, `{`, etc.). Zero or more
    // leading `:`s indicate indented glosses (sub-definitions).
    const m = line.match(/^:*#\s*(.+)$/)
    if (!m) continue
    const cleaned = stripWikiMarkup(m[1])
    if (!cleaned) continue
    out.push({ partOfSpeech: currentPos, definition: cleaned })
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

// Internal: a single fetch with timeout + signal forwarding. Returns the
// raw Response, or null on abort/timeout. Catches the caller-supplied
// `fetch` for test injection.
async function fetchWithTimeout(url, opts, fetchImpl, timeoutMs) {
  const ac = new AbortController()
  const onAbort = () => ac.abort()
  if (opts?.signal) opts.signal.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...opts, signal: ac.signal })
  } catch (e) {
    if (e?.name === 'AbortError') return null
    throw e
  } finally {
    clearTimeout(timer)
    if (opts?.signal) opts.signal.removeEventListener('abort', onAbort)
  }
}

// Decide whether a 200 response body is JSON or HTML. Wiktionary's REST
// endpoint usually sets Content-Type correctly, but a Parsoid HTML page
// can slip through with `text/html` — guard explicitly.
async function readResponseAsJsonOrText(res) {
  const ct = (res.headers?.get?.('content-type') || '').toLowerCase()
  if (ct.includes('json')) {
    try {
      return { kind: 'json', json: await res.json() }
    } catch {
      return { kind: 'text', text: '' }
    }
  }
  // Fall back to plain text so the caller can decide what to do.
  let text = ''
  try { text = await res.text() } catch { /* ignore */ }
  return { kind: 'text', text }
}

// Network call. Returns { ok: true, definitions: string[], error: null } on
// success, { ok: false, definitions: [], error: string } on any failure —
// the modal's "no result" UI consumes `error` and the user can still type
// the meaning by hand.
//
// `languageCode` is the ISO 639-1 code of the source language (the
// language of the term being looked up). It only matters on the fallback
// action API path, where we narrow the wikitext to that section.
export async function lookupWord(term, { languageCode = null, signal, fetch: fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const restUrl = lookupUrl(term)
  if (!restUrl) return { ok: false, definitions: [], error: 'No term' }

  // ── 1. Primary: REST definition endpoint ─────────────────────────────
  let res
  try {
    res = await fetchWithTimeout(restUrl, { signal, headers: { accept: 'application/json' } }, fetchImpl, timeoutMs)
  } catch (e) {
    return { ok: false, definitions: [], error: e?.message || 'Network error' }
  }
  if (!res) return { ok: false, definitions: [], error: 'Timed out' }
  if (res.status === 404) {
    // REST has no JSON for this entry — could be a real missing word OR an
    // HTML-only page. Try the action API before giving up.
  } else if (!res.ok) {
    return { ok: false, definitions: [], error: `HTTP ${res.status}` }
  } else {
    const body = await readResponseAsJsonOrText(res)
    if (body.kind === 'json') {
      const defs = allDefinitions(body.json)
      if (defs.length) return { ok: true, definitions: defs, error: null }
      // Empty JSON (a real entry with no definitions) — don't fall through,
      // the action API would just return HTML for the same page.
      return { ok: false, definitions: [], error: 'No definitions' }
    }
    // body.kind === 'text' — REST returned HTML (Parsoid rendering for an
    // inflection or similar). Fall through to the action API.
  }

  // ── 2. Fallback: action API, parse the wikitext ourselves ────────────
  const actionUrl = actionApiUrl(term, languageCode)
  if (!actionUrl) return { ok: false, definitions: [], error: 'No term' }
  let actionRes
  try {
    actionRes = await fetchWithTimeout(actionUrl, { signal, headers: { accept: 'application/json' } }, fetchImpl, timeoutMs)
  } catch (e) {
    return { ok: false, definitions: [], error: e?.message || 'Network error' }
  }
  if (!actionRes) return { ok: false, definitions: [], error: 'Timed out' }
  if (actionRes.status === 404) {
    return { ok: false, definitions: [], error: 'No entry' }
  }
  if (!actionRes.ok) {
    return { ok: false, definitions: [], error: `HTTP ${actionRes.status}` }
  }
  let actionJson
  try {
    actionJson = await actionRes.json()
  } catch {
    return { ok: false, definitions: [], error: 'Bad response' }
  }
  const wikitext = actionJson?.parse?.wikitext?.['*'] || ''
  if (!wikitext) return { ok: false, definitions: [], error: 'No entry' }
  const parsed = parseWikitextDefinitions(wikitext, languageCode)
  if (!parsed.length) return { ok: false, definitions: [], error: 'No definitions' }
  return { ok: true, definitions: parsed.map((d) => d.definition), error: null }
}