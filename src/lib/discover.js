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

export const MAX_ROWS = 3
export const ROW_SIZE = 6
export const SHORT_READ_MAX_PAGES = 250
export const LAGGING_WINDOW_DAYS = 28
export const RATING_FLOOR = 4

function normAuthor(s) {
  return (s || '').toLowerCase().trim()
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

// The tracked language that's had the least study time lately. Requires at
// least two languages with a book code — with one language there's nothing to
// lag behind. Ties break toward the language with the fewest saved books
// (thinnest shelf needs the most help), then by name for determinism.
export function laggingLanguage(entries = [], languages = [], today = localDateStr(new Date()), { windowDays = LAGGING_WINDOW_DAYS } = {}) {
  const codable = languages
    .map((l) => ({ id: l.id, name: l.name, code: codeForName(l.name) }))
    .filter((l) => l.code)
  if (codable.length < 2) return null

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

export function shortReadsSeed(entries = [], languages = [], savedBooks = [], today = localDateStr(new Date())) {
  const lagging = laggingLanguage(entries, languages, today)
  if (!lagging) return null
  return {
    kind: 'short_reads',
    key: `short:${lagging.code}`,
    title: `Short reads in ${lagging.name}`,
    reason: `${lagging.name} has been quiet lately — something small to restart it.`,
    query: 'subject:fiction',
    languageCode: lagging.code,
    postFilter: { maxPages: SHORT_READ_MAX_PAGES, sort: 'shortest' },
  }
}

// The row lineup, in display order. Nulls (signals that don't apply yet)
// simply drop out — a brand-new library produces zero rows and the section
// renders nothing.
export function buildDiscoverSeeds({ savedBooks = [], entries = [], languages = [], today = localDateStr(new Date()) } = {}) {
  const loved = moreByAuthorSeed(savedBooks, today)
  const finished = becauseFinishedSeed(savedBooks, loved ? loved.query : null)
  const short = shortReadsSeed(entries, languages, savedBooks, today)
  return [loved, finished, short].filter(Boolean).slice(0, MAX_ROWS)
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
