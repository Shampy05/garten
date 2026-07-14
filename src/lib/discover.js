// Discover rows — the Library's recommendation area. Replaces the old single
// "More by <last finished author>" strip with up to MAX_ROWS rows, each built
// from a different signal and each carrying a human-readable reason for
// existing. Everything here is pure: seed builders read saved books / study
// entries and return descriptors; the network call (searchBooksMerged) is
// made by useDiscover, never here, so this file tests offline.
//
// A seed: { kind, key, title, reason, query, languageCode, postFilter? }.
// `key` embeds the seed's inputs (author+language, finished externalId,
// language code), so when the underlying signal changes — a new finished
// book, a different lagging language — the key changes and the 24h row cache
// (discoverCache.js) naturally misses instead of serving stale picks.

import { localDateStr } from './date.js'
import { codeForName } from './bookLanguages.js'
import { sortBooks } from './bookSearch.js'
import { stopwordsFor } from './stopwords.js'

export const MAX_ROWS = 3
export const ROW_SIZE = 6
export const SHORT_READ_MAX_PAGES = 250
export const LAGGING_WINDOW_DAYS = 28
export const RATING_FLOOR = 4

// How many top content words from a finished book description we use as the
// "more like this" search seed. 2 is the minimum for any signal at all; 3
// keeps the query focused; 4+ drifts toward the noisy literary terms
// (love/family/world) that Google's index returns the same 50 results for.
const MORE_LIKE_THIS_SEED_WORDS = 3

// Minimum description length (chars) before we mine it for content words —
// shorter descriptions are usually Google/Open Library boilerplate that
// doesn't carry usable theme signal. Below this we fall back to the book
// title (always present) so the row never silently disappears just
// because a book happens to have a short blurb.
const MORE_LIKE_THIS_MIN_DESC_CHARS = 40

function normAuthor(s) {
  return (s || '').trim().toLowerCase()
}

function daysSinceEpoch(today) {
  return Math.floor(new Date(today + 'T12:00:00').getTime() / 86400000)
}

// Finished books that qualify as "loved": rated at RATING_FLOOR or above,
// with an author and language to search by. Newest finish first.
function lovedFinished(savedBooks) {
  return savedBooks
    .filter(
      (b) =>
        b.record?.status === 'read' &&
        b.record?.finishedAt &&
        Number(b.record?.rating) >= RATING_FLOOR &&
        b.author &&
        b.languageCode
    )
    .sort((a, b) => String(b.record.finishedAt).localeCompare(String(a.record.finishedAt)))
}

// "More by <author>" — seeded from books the user finished AND rated highly,
// not just whatever they finished last. With several loved authors the row
// rotates daily between them, so the strip doesn't fossilise on one name.
export function moreByAuthorSeed(savedBooks = [], today = localDateStr(new Date())) {
  const loved = lovedFinished(savedBooks)
  if (!loved.length) return null
  // One candidate per author (their most recent loved finish).
  const seen = new Set()
  const candidates = []
  for (const b of loved) {
    const a = normAuthor(b.author)
    if (seen.has(a)) continue
    seen.add(a)
    candidates.push(b)
  }
  const pick = candidates[daysSinceEpoch(today) % candidates.length]
  return {
    kind: 'more_by_author',
    key: `author:${normAuthor(pick.author)}:${pick.languageCode}`,
    title: `More by ${pick.author}`,
    reason: `Because you loved ${pick.title}.`,
    query: pick.author,
    languageCode: pick.languageCode,
  }
}

// "Because you finished <title>" — the most recent finish (any rating) by a
// different author than the loved row, so the two rows never collapse into
// the same author twice.
export function becauseFinishedSeed(savedBooks = [], excludeAuthor = null) {
  const finished = savedBooks
    .filter((b) => b.record?.status === 'read' && b.record?.finishedAt && b.author && b.languageCode)
    .sort((a, b) => String(b.record.finishedAt).localeCompare(String(a.record.finishedAt)))
  const excluded = normAuthor(excludeAuthor)
  for (const b of finished) {
    if (excluded && normAuthor(b.author) === excluded) continue
    return {
      kind: 'because_finished',
      key: `finished:${b.externalId || b.id}`,
      title: `Because you finished ${b.title}`,
      reason: `More from ${b.author} to keep the thread going.`,
      query: b.author,
      languageCode: b.languageCode,
    }
  }
  return null
}

// The tracked language that's had the least study time lately. Returns null
// only when there are zero codable tracked languages — with a single tracked
// language it returns that language (it's the lagging one by default). Ties
// break by name for determinism. (Was previously used by the now-removed
// Short Reads row, but kept exported for any future recommendation signal
// that needs the same lag calculation.)
export function laggingLanguage(entries = [], languages = [], today = localDateStr(new Date()), { windowDays = LAGGING_WINDOW_DAYS } = {}) {
  const codable = languages
    .map((l) => ({ id: l.id, name: l.name, code: codeForName(l.name) }))
    .filter((l) => l.code)
  if (!codable.length) return null

  const cutoff = new Date(today + 'T12:00:00')
  cutoff.setDate(cutoff.getDate() - windowDays)
  const cutoffStr = localDateStr(cutoff)

  const minutesByLang = {}
  for (const e of entries) {
    if (e.date < cutoffStr || e.date > today) continue
    minutesByLang[e.languageId] = (minutesByLang[e.languageId] || 0) + (Number(e.hours) || 0) * 60 + (Number(e.minutes) || 0)
  }

  const rows = codable.map((l) => ({ ...l, minutes: minutesByLang[l.id] || 0 }))
  rows.sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name))
  return rows[0]
}

// Top content words from a passage: tokenize, drop stopwords (per language)
// and very short / very long tokens, then return the highest-frequency
// `count` words in the order the reader met them (so two equally-frequent
// words break by first-occurrence — determinism > no determinism).
//
// Pure: takes a passage string + optional languageCode. Falls back to no
// stopword filtering for languages stopwords.js doesn't cover (see that
// file's docstring for the rationale).
export function topContentWords(passage, { count = MORE_LIKE_THIS_SEED_WORDS, languageCode = null } = {}) {
  const text = String(passage || '')
  if (!text) return []
  const stop = stopwordsFor(languageCode)
  // A \p{L} token set, stricter than a general tokenizer (max 24 chars for
  // theme words) and dropping any token that's not a plausible noun. Order
  // is by frequency, not first-occurrence.
  const counts = new Map()
  const firstSeen = new Map()
  let i = 0
  for (const m of text.toLowerCase().matchAll(/[\p{L}\p{M}']+/gu)) {
    const tok = m[0]
    if (tok.length < 3 || tok.length > 24) continue
    if (stop && stop.has(tok)) continue
    if (/\d/.test(tok)) continue
    counts.set(tok, (counts.get(tok) || 0) + 1)
    if (!firstSeen.has(tok)) firstSeen.set(tok, i++)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0]) - firstSeen.get(b[0]))
    .slice(0, count)
    .map(([tok]) => tok)
}

// "Books like <title>" — seeded from the most recently finished book that
// has a usable description AND a language the user is currently watering
// (tracked). The query is a 1–3-word string built from the book's
// description, run through Google/Open Library filtered to the book's
// language — so a German "Reunion" finished book yields other German
// books that share the same content words, not English translations.
//
// Honest framing in the UI: "Sharing themes with <title> by <author>." —
// this is a content-similarity pull, not a personalised recommender; the
// book APIs do not expose a real "for you" endpoint, so we make the best
// of the description's strongest nouns and let the user decide whether
// the hits resonate.
//
// Source preference: description (richer theme signal) → title (always
// present) → author + title (last-resort). We never silently drop a row
// just because the saved book has a short blurb.
export function moreLikeThisSeed(savedBooks = [], languages = [], today = localDateStr(new Date())) {
  const trackedCodes = new Set(
    languages
      .map((l) => codeForName(l.name))
      .filter(Boolean)
  )

  const candidates = savedBooks
    .filter((b) =>
      b.record?.status === 'read' &&
      b.record?.finishedAt &&
      b.languageCode &&
      trackedCodes.has(b.languageCode)
    )
    .sort((a, b) => String(b.record.finishedAt).localeCompare(String(a.record.finishedAt)))

  for (const book of candidates) {
    // Build the query from the richest source available, falling back
    // through description → title → author+title so the row always
    // produces a usable query as long as the book has a title.
    const desc = typeof book.description === 'string' ? book.description.trim() : ''
    let source = ''
    let reason = ''
    if (desc.length >= MORE_LIKE_THIS_MIN_DESC_CHARS) {
      source = desc
      reason = `Sharing themes with ${book.title} by ${book.author || 'this author'}.`
    } else if (book.title) {
      // Title is short — combine with the author for a richer query, framed
      // honestly so the user knows this is a "more from this title/author"
      // pull, not a deep theme match.
      source = [book.title, book.author].filter(Boolean).join(' ')
      reason = `Other books around “${book.title}”.`
    } else {
      continue
    }

    const seeds = topContentWords(source, {
      count: MORE_LIKE_THIS_SEED_WORDS,
      languageCode: book.languageCode,
    })
    if (seeds.length < 1) continue
    return {
      kind: 'more_like_this',
      key: `more_like_this:${book.id || book.externalId}:${today}`,
      title: `Books like ${book.title}`,
      reason,
      query: seeds.join(' '),
      languageCode: book.languageCode,
    }
  }
  return null
}

// The row lineup, in display order. Nulls (signals that don't apply yet)
// simply drop out — a brand-new library produces zero rows and the section
// renders nothing.
//
// Order: loved author, just-finished author, books-like-latest — three
// high-signal rows that all read from the user's own library. The
// "More like this" row is a content-similarity pull from the most
// recently finished book; the book APIs don't expose a true "for you"
// endpoint, so we make the best of the description's strongest nouns.
export function buildDiscoverSeeds({ savedBooks = [], entries = [], languages = [], today = localDateStr(new Date()) } = {}) {
  const loved = moreByAuthorSeed(savedBooks, today)
  const finished = becauseFinishedSeed(savedBooks, loved ? loved.query : null)
  const moreLike = moreLikeThisSeed(savedBooks, languages, today)
  return [loved, finished, moreLike].filter(Boolean).slice(0, MAX_ROWS)
}

// Render-time shaping of a row's raw fetched books: drop what's already in
// the library and what an earlier row already placed (cross-row dedupe),
// apply the seed's page cap, sort, and cut to ROW_SIZE. Runs at render — not
// at fetch — so saving a book hides it from every row immediately without
// touching the cache.
export function filterRowBooks(books = [], { savedExternalIds = new Set(), excludeExternalIds = new Set(), maxPages = null, sort = null } = {}) {
  let list = books.filter(
    (b) => !savedExternalIds.has(b.externalId) && !excludeExternalIds.has(b.externalId)
  )
  if (maxPages) {
    list = list.filter((b) => Number(b.pageCount) > 0 && Number(b.pageCount) <= maxPages)
  }
  if (sort) list = sortBooks(list, sort)
  return list.slice(0, ROW_SIZE)
}
