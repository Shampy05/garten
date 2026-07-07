// Vocab mining — pure tokenizer that pulls candidate new-word chips out of a
// passage (the saved book's description, or a paragraph the user pasted from
// the page they just read). Pure & sync: no I/O, no dictionaries. Designed to
// be called by MineWordsModal after `book.description` loads or the user types
// in their own passage.
//
// Pipeline: lowercase → strip punctuation → unicode-letters-aware split →
// trim length (MIN_LEN..MAX_LEN) → drop numbers → dedupe case-insensitive →
// drop already-planted terms (per language) → optional stopword filter
// (stopwords.js) → sort by first occurrence so the order the reader met the
// words in is preserved.
//
// Stopword coverage today: EN/ES/FR/DE/IT. Languages outside that set fall
// back to length/dedupe filtering only — see stopwords.js for the rationale.

import { stopwordsFor } from './stopwords.js'

export const MIN_LEN = 3
export const MAX_LEN = 30

// Punctuation/whitespace split — \p{L} covers Latin, Greek, Cyrillic, etc.
// so accented and non-Latin scripts survive. Anything that isn't a letter or
// apostrophe (for elided forms like "l'arbre") becomes a separator.
const TOKEN_RE = /[\p{L}\p{M}']+/gu

// Anything containing a digit is a number/quantity, not a word worth planting.
function looksNumeric(s) {
  return /\d/.test(s)
}

// Pure entry point. Returns { candidates, skipped: { planted, stopword, length } }
// so the modal can show "Planted already" chips for already-planted terms and
// keep new-word chips selectable. `plantedTerms` is an iterable of strings
// (lowercased for comparison). `languageCode` is the ISO 639-1 code; when
// stopwords.js has no list for it the stopword stage is skipped.
export function mineCandidates(passage, { plantedTerms = [], languageCode = null } = {}) {
  const text = String(passage || '')
  const stop = stopwordsFor(languageCode)
  const plantedSet = new Set([...plantedTerms].map((t) => String(t || '').trim().toLowerCase()))
  const seen = new Set()
  const candidates = []
  const skipped = { planted: [], stopword: [], length: [] }

  for (const raw of text.matchAll(TOKEN_RE)) {
    const tok = raw[0]
    const lower = tok.toLowerCase()

    // Length guard: drop very short (often clitics / fragments) and absurdly
    // long (tokeniser accident) tokens.
    if (lower.length < MIN_LEN || lower.length > MAX_LEN) {
      skipped.length.push(tok)
      continue
    }
    if (looksNumeric(tok)) {
      skipped.length.push(tok)
      continue
    }

    // First occurrence wins: dedupe preserves the order the reader met the
    // words in, which matches the mental model of "the words on this page".
    if (seen.has(lower)) continue
    seen.add(lower)

    // Stopword filter: skipped silently. Stopword lists are curated per
    // language; languages without a list fall through to the already-planted
    // check below (no filtering here — see stopwords.js).
    if (stop && stop.has(lower)) {
      skipped.stopword.push(tok)
      continue
    }

    // Already-planted filter: show these as muted chips in the modal so the
    // user knows the words didn't just disappear.
    if (plantedSet.has(lower)) {
      skipped.planted.push(tok)
      continue
    }

    candidates.push(tok)
  }

  return { candidates, skipped }
}

// One-stop helper: just the new-word list. Mining modal calls this when it
// needs the candidate array without the diagnostic `skipped` breakdown.
export function mineNewWords(passage, opts) {
  return mineCandidates(passage, opts).candidates
}