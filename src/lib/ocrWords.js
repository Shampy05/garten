// Camera word mining — turns the edge function's compact OCR payload
// ({ width, height, words: [{ text, quad }] }) into tappable candidates for
// the ScanPageModal overlay + chip list.
//
// Pipeline: clean punctuation off each raw OCR token → length guard →
// numeric drop → per-term dedupe (case-insensitive, reading order) →
// already-planted tagging → stopword tagging. Mirrors the removed
// vocabMining.js pipeline (git show 2a8da9a^:src/lib/vocabMining.js) but
// works from OCR word boxes instead of a pasted passage, and keeps every
// in-range token (stopwords are tagged, not dropped — see below).

import { stopwordsFor } from './stopwords.js'

export const MIN_LEN = 3
export const MAX_LEN = 30

// Anything containing a digit is a number/quantity, not a word worth planting.
function looksNumeric(s) {
  return /\d/.test(s)
}

// Strip leading/trailing non-letter characters (quotes, guillemets,
// brackets, sentence punctuation) while keeping internal apostrophes/
// hyphens that are part of the word itself ("l'arbre", "Groß-Stadt").
// \p{L}\p{M} covers Latin, Greek, Cyrillic, and other scripts with
// combining marks.
const LEADING_JUNK = /^[^\p{L}\p{M}]+/u
const TRAILING_JUNK = /[^\p{L}\p{M}]+$/u

export function cleanToken(raw) {
  return String(raw || '').replace(LEADING_JUNK, '').replace(TRAILING_JUNK, '')
}

// quad = [x0,y0,x1,y1,x2,y2,x3,y3] → SVG <polygon points="..."> string.
export function quadPoints(quad) {
  if (!Array.isArray(quad) || quad.length !== 8) return ''
  const pts = []
  for (let i = 0; i < 8; i += 2) pts.push(`${quad[i]},${quad[i + 1]}`)
  return pts.join(' ')
}

// Main entry. `ocrPayload` is the edge function's normalized response.
// `plantedTerms` is an iterable of the user's already-planted terms in the
// target language (for muting); `languageCode` is the ISO 639-1 code used
// to look up a stopword set.
//
// Selection is per-term, not per-occurrence: the same word photographed
// twice on a page is one selectable candidate, and toggling it toggles
// every polygon that spells it.
export function buildOcrCandidates(ocrPayload, { plantedTerms = [], languageCode = null } = {}) {
  const width = ocrPayload?.width || 0
  const height = ocrPayload?.height || 0
  const words = Array.isArray(ocrPayload?.words) ? ocrPayload.words : []
  const stop = stopwordsFor(languageCode)
  const plantedSet = new Set([...plantedTerms].map((t) => String(t || '').trim().toLowerCase()))

  const tokens = []
  const firstSeenAt = new Map() // lower -> index into `terms` (reading order)
  const terms = []

  for (const w of words) {
    const cleaned = cleanToken(w?.text)
    const lower = cleaned.toLowerCase()
    const quad = Array.isArray(w?.quad) ? w.quad : [0, 0, 0, 0, 0, 0, 0, 0]
    const points = quadPoints(quad)

    if (!cleaned || cleaned.length < MIN_LEN || cleaned.length > MAX_LEN || looksNumeric(cleaned)) {
      tokens.push({ id: tokens.length, raw: w?.text || '', term: cleaned, lower, quad, points, status: 'skipped', stopword: false })
      continue
    }

    const planted = plantedSet.has(lower)
    const stopword = Boolean(stop && stop.has(lower))
    const status = planted ? 'planted' : 'candidate'

    tokens.push({ id: tokens.length, raw: w.text, term: cleaned, lower, quad, points, status, stopword })

    if (!planted && !firstSeenAt.has(lower)) {
      firstSeenAt.set(lower, terms.length)
      terms.push({ term: cleaned, lower, stopword })
    }
  }

  return { width, height, tokens, terms }
}
