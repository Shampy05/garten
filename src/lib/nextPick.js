// "Your next read" — a single spotlighted pick for the top of the Up-next
// shelf, chosen by a first-match priority ladder over data the library
// already holds (the queue, the other shelves, study entries). Pure and
// deterministic; `today` is injected so tests can pin any date. The caller
// passes the *filtered* queue — whatever is on screen — so the pick always
// belongs to the user's current view. Returns null only when the queue is
// empty; rung 4 always matches, so a visible queue always leads with a
// recommendation rather than a bare grid.

import { localDateStr } from './date.js'
import { lastWateredByLanguage } from './nextAction.js'
import { codeForName, nameForCode } from './bookLanguages.js'

// Matches nextAction's "neglected language" rung so the garden header and the
// library shelf agree on when a language counts as left un-watered.
export const NEGLECT_DAYS = 7

// Books at or under this page count read as "a short win".
export const SHORT_PAGE_LIMIT = 220

function daysAgo(dateStr, today) {
  const a = new Date(today + 'T12:00:00')
  const b = new Date(dateStr + 'T12:00:00')
  return Math.round((a - b) / 86400000)
}

// Days since each tracked language was last studied, keyed by its ISO 639-1
// book code: { fr: { name: 'French', days: 9 } }. Languages never logged are
// absent (not "neglected", just not started — same stance as nextAction.js),
// as are languages outside the curated reading set (no book code → no books).
export function neglectDaysByCode(entries = [], languages = [], today = localDateStr(new Date())) {
  const lastByLang = lastWateredByLanguage(entries)
  const out = {}
  for (const lang of languages) {
    const code = codeForName(lang.name)
    if (!code) continue
    const last = lastByLang[lang.id]
    if (!last) continue
    out[code] = { name: lang.name, days: Math.max(0, daysAgo(last, today)) }
  }
  return out
}

// The queued book with the smallest known page count, or null when none carry
// one. Saved books very often lack totalPages — those simply never qualify.
export function shortestKnown(books = []) {
  let best = null
  for (const b of books) {
    const pages = Number(b.record?.totalPages) || 0
    if (pages <= 0) continue
    if (!best || pages < Number(best.record.totalPages)) best = b
  }
  return best
}

// The most common difficulty among finished books in a language, with its
// count: { difficulty: 'intermediate', count: 3 } — or null when fewer than
// two finished books carry a difficulty (one data point can't over-claim) or
// when the top spot is tied (no clear signal).
export function modalDifficulty(finishedBooks = [], languageCode) {
  const counts = {}
  let total = 0
  for (const b of finishedBooks) {
    if (b.languageCode !== languageCode) continue
    const d = b.record?.difficulty
    if (!d) continue
    counts[d] = (counts[d] || 0) + 1
    total += 1
  }
  if (total < 2) return null
  let best = null
  let tie = false
  for (const [difficulty, count] of Object.entries(counts)) {
    if (!best || count > best.count) {
      best = { difficulty, count }
      tie = false
    } else if (count === best.count) {
      tie = true
    }
  }
  return tie ? null : best
}

export function computeNextPick({
  queue = [],
  activeBooks = [],
  finishedBooks = [],
  entries = [],
  languages = [],
  today = localDateStr(new Date()),
} = {}) {
  if (queue.length === 0) return null

  // 1. A neglected language with something queued and nothing on the Reading
  //    shelf covering it — the pick is the nudge back. Prefer a short book in
  //    that language when one is known, and say both things at once.
  const neglect = neglectDaysByCode(entries, languages, today)
  const activeCodes = new Set(activeBooks.map((b) => b.languageCode).filter(Boolean))
  let worst = null
  for (const [code, info] of Object.entries(neglect)) {
    if (info.days < NEGLECT_DAYS) continue
    if (activeCodes.has(code)) continue
    const candidates = queue.filter((b) => b.languageCode === code)
    if (candidates.length === 0) continue
    if (!worst || info.days > worst.days) worst = { ...info, candidates }
  }
  if (worst) {
    const short = shortestKnown(worst.candidates)
    if (short && Number(short.record.totalPages) <= SHORT_PAGE_LIMIT) {
      return {
        book: short,
        kind: 'neglected',
        reason: `A short win in ${worst.name} — you haven't watered it in ${worst.days} days.`,
      }
    }
    return {
      book: worst.candidates[0],
      kind: 'neglected',
      reason: `Time to water your ${worst.name} — ${worst.days} days since your last session.`,
    }
  }

  // 2. A quick finish anywhere in the queue.
  const short = shortestKnown(queue)
  if (short && Number(short.record.totalPages) <= SHORT_PAGE_LIMIT) {
    return {
      book: short,
      kind: 'short',
      reason: `A quick finish — only ${short.record.totalPages} pages.`,
    }
  }

  // 3. A queued book at the difficulty the user demonstrably finishes in that
  //    language. Walk in queue order so manual ranking still breaks ties.
  for (const book of queue) {
    const d = book.record?.difficulty
    if (!d) continue
    const modal = modalDifficulty(finishedBooks, book.languageCode)
    if (modal && modal.difficulty === d) {
      return {
        book,
        kind: 'difficulty',
        reason: `Right at your level — you've finished ${modal.count} ${d} books in ${nameForCode(book.languageCode)}.`,
      }
    }
  }

  // 4. The queue's own front — always matches.
  return {
    book: queue[0],
    kind: 'queue-top',
    reason: 'Next in line — you queued it yourself.',
  }
}
