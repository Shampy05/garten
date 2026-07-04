// Pure view-model math for the Gardener profile (self mode). Kept out of the
// component so it can be unit-tested and reused. Everything here reads only
// data the app already holds in memory — no Supabase calls, no new reads.

import { targetHours, levelForHours } from './proficiency.js'

const MINUTES = (e) => e.hours * 60 + e.minutes

// Short CEFR badge for a language's accumulated hours, or null when the learner
// is essentially just starting. Past the professional-proficiency target we
// show "C1+" rather than pretending the scale continues.
export function shortLevel(languageName, hours, nativeLanguage = null) {
  const h = Number(hours) || 0
  if (h <= 0) return null
  if (h >= targetHours(languageName, nativeLanguage)) return 'C1+'
  const key = levelForHours(languageName, h, nativeLanguage)
  if (key === 'none') return null
  return key.toUpperCase()
}

// One summary bar per language: accumulated hours (prior credit + logged)
// against the base proficiency target, with a level badge. Sorted by the most
// tended first; languages with no hours at all drop off.
//
// The `targetHours` + `levelForHours` calls go through the canonical name
// (lang.name) — proficiency math is data, not display, and it keys on the
// canonical so a nickname change can never move a target hour. The returned
// `name` is the display label (nickname or canonical) so the profile modal
// shows what the user calls this language in their garden.
export function languageHorizons(entries = [], languages = [], nativeLanguage = null) {
  const loggedByLang = {}
  for (const e of entries) {
    loggedByLang[e.languageId] = (loggedByLang[e.languageId] || 0) + MINUTES(e)
  }
  return languages
    .map((lang) => {
      const prior = Number(lang.prior_hours) || 0
      const logged = (loggedByLang[lang.id] || 0) / 60
      const total = prior + logged
      const target = targetHours(lang.name, nativeLanguage)
      const alias = typeof lang.nickname === 'string' ? lang.nickname.trim() : ''
      return {
        id: lang.id,
        name: alias || lang.name,
        color: lang.color,
        hours: total,
        target,
        pct: target > 0 ? Math.min(100, (total / target) * 100) : 0,
        level: shortLevel(lang.name, total, nativeLanguage),
      }
    })
    .filter((r) => r.hours > 0)
    .sort((a, b) => b.hours - a.hours)
}

// Longest run of consecutive days across all activity, in days.
export function longestStreak(dates = []) {
  const uniq = [...new Set(dates)].sort()
  if (uniq.length === 0) return 0
  let best = 1
  let run = 1
  for (let i = 1; i < uniq.length; i++) {
    const prev = new Date(uniq[i - 1] + 'T12:00:00')
    const curr = new Date(uniq[i] + 'T12:00:00')
    const diff = Math.round((curr - prev) / 86400000)
    if (diff === 1) {
      run += 1
      best = Math.max(best, run)
    } else if (diff > 1) {
      run = 1
    }
  }
  return best
}

// The book to spotlight as "currently reading": an in-progress book, preferring
// the one most recently started, then the furthest along. Returns a compact
// shape for the profile card, or null when nothing is being read.
export function currentReadingBook(savedBooks = []) {
  const reading = savedBooks.filter((b) => b.record && b.record.status === 'reading')
  if (reading.length === 0) return null
  const progress = (b) => {
    const cur = Number(b.record.currentPage) || 0
    const tot = Number(b.record.totalPages) || 0
    return tot > 0 ? cur / tot : 0
  }
  reading.sort((a, b) => {
    const byStart = String(b.record.startedAt || '').localeCompare(String(a.record.startedAt || ''))
    if (byStart !== 0) return byStart
    return progress(b) - progress(a)
  })
  const book = reading[0]
  const cur = Number(book.record.currentPage) || 0
  const tot = Number(book.record.totalPages) || 0
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    languageCode: book.languageCode,
    currentPage: cur,
    totalPages: tot,
    pct: tot > 0 ? Math.min(100, Math.round((cur / tot) * 100)) : 0,
  }
}

// The "nightstand" — a small strip of every book currently in progress, in
// the same started-then-furthest-along order as `currentReadingBook`. Up to
// `limit` (default 4); empty array when there's nothing being read. Returns
// the same compact shape as currentReadingBook so the component can render
// each cover identically.
export function nightstandBooks(savedBooks = [], limit = 4) {
  const reading = savedBooks.filter((b) => b.record && b.record.status === 'reading')
  if (reading.length === 0) return []
  const progress = (b) => {
    const cur = Number(b.record.currentPage) || 0
    const tot = Number(b.record.totalPages) || 0
    return tot > 0 ? cur / tot : 0
  }
  const sorted = reading.slice().sort((a, b) => {
    const byStart = String(b.record.startedAt || '').localeCompare(String(a.record.startedAt || ''))
    if (byStart !== 0) return byStart
    return progress(b) - progress(a)
  })
  return sorted.slice(0, limit).map((book) => {
    const cur = Number(book.record.currentPage) || 0
    const tot = Number(book.record.totalPages) || 0
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      languageCode: book.languageCode,
      currentPage: cur,
      totalPages: tot,
      pct: tot > 0 ? Math.min(100, Math.round((cur / tot) * 100)) : 0,
    }
  })
}

// A handful of earned "recent milestones" for the self profile — the proud,
// non-preachy highlights. Threshold ladders so only the highest cleared rung of
// each kind shows. Returns at most `limit`, ordered by our sense of impressiveness.
const HOUR_RUNGS = [1000, 500, 250, 100, 50, 25, 10]
const STREAK_RUNGS = [365, 180, 100, 30, 14, 7]

export function selfMilestones(
  { entries = [], languages = [], savedBooks = [], nativeLanguage = null } = {},
  limit = 4
) {
  const out = []

  const totalHours = entries.reduce((s, e) => s + MINUTES(e), 0) / 60
  const hourRung = HOUR_RUNGS.find((r) => totalHours >= r)
  if (hourRung) {
    out.push({ key: 'hours', icon: 'clock', label: `${hourRung}+ hours tended`, weight: 100 + hourRung })
  }

  const best = longestStreak(entries.map((e) => e.date))
  const streakRung = STREAK_RUNGS.find((r) => best >= r)
  if (streakRung) {
    out.push({ key: 'streak', icon: 'flame', label: `${streakRung}-day streak reached`, weight: 90 + streakRung })
  }

  // Languages that have crossed into upper-intermediate or beyond.
  const horizons = languageHorizons(entries, languages, nativeLanguage)
  const advanced = horizons.filter((h) => h.level === 'B2' || h.level === 'C1+')
  for (const h of advanced) {
    out.push({
      key: `level-${h.id}`,
      icon: 'sprout',
      label: `${h.name} at ${h.level}`,
      weight: 80 + (h.level === 'C1+' ? 10 : 0),
    })
  }

  const finished = savedBooks.filter((b) => b.record && b.record.status === 'read').length
  if (finished > 0) {
    out.push({
      key: 'books',
      icon: 'book',
      label: `${finished} book${finished === 1 ? '' : 's'} finished`,
      weight: 60 + finished,
    })
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, limit)
}
