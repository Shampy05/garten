import { describe, it, expect } from 'vitest'
import {
  computeNextPick,
  neglectDaysByCode,
  shortestKnown,
  modalDifficulty,
  NEGLECT_DAYS,
  SHORT_PAGE_LIMIT,
} from './nextPick.js'

const TODAY = '2026-07-07'

function book(id, languageCode, { totalPages = null, difficulty = null, status = 'want_to_read' } = {}) {
  return {
    id,
    title: `Book ${id}`,
    languageCode,
    record: { status, totalPages, difficulty },
  }
}

// A study entry `days` days before TODAY.
function entry(languageId, days) {
  const d = new Date(TODAY + 'T12:00:00')
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return { languageId, date: `${y}-${m}-${day}` }
}

const FRENCH = { id: 'french', name: 'French' }
const SPANISH = { id: 'spanish', name: 'Spanish' }

describe('neglectDaysByCode', () => {
  it('keys days-since-last-session by book code', () => {
    const out = neglectDaysByCode([entry('french', 9)], [FRENCH], TODAY)
    expect(out).toEqual({ fr: { name: 'French', days: 9 } })
  })

  it('omits never-studied languages (not neglected, just not started)', () => {
    const out = neglectDaysByCode([entry('french', 9)], [FRENCH, SPANISH], TODAY)
    expect(out.es).toBeUndefined()
  })

  it('omits languages outside the curated reading set', () => {
    const out = neglectDaysByCode([entry('klingon', 9)], [{ id: 'klingon', name: 'Klingon' }], TODAY)
    expect(out).toEqual({})
  })

  it('uses the most recent session per language', () => {
    const out = neglectDaysByCode([entry('french', 20), entry('french', 3)], [FRENCH], TODAY)
    expect(out.fr.days).toBe(3)
  })
})

describe('shortestKnown', () => {
  it('returns the book with the smallest known page count', () => {
    const books = [book('a', 'fr', { totalPages: 300 }), book('b', 'fr', { totalPages: 150 })]
    expect(shortestKnown(books)?.id).toBe('b')
  })

  it('ignores missing and zero page counts, returns null when none known', () => {
    expect(shortestKnown([book('a', 'fr'), book('b', 'fr', { totalPages: 0 })])).toBeNull()
  })
})

describe('modalDifficulty', () => {
  const fin = (id, code, difficulty) => book(id, code, { status: 'read', difficulty })

  it('returns the most common difficulty with its count', () => {
    const finished = [fin('a', 'es', 'intermediate'), fin('b', 'es', 'intermediate'), fin('c', 'es', 'beginner')]
    expect(modalDifficulty(finished, 'es')).toEqual({ difficulty: 'intermediate', count: 2 })
  })

  it('returns null with fewer than two rated finishes (one data point cannot over-claim)', () => {
    expect(modalDifficulty([fin('a', 'es', 'advanced')], 'es')).toBeNull()
  })

  it('returns null on a tie', () => {
    const finished = [fin('a', 'es', 'beginner'), fin('b', 'es', 'advanced')]
    expect(modalDifficulty(finished, 'es')).toBeNull()
  })

  it('only counts the requested language', () => {
    const finished = [fin('a', 'fr', 'beginner'), fin('b', 'fr', 'beginner'), fin('c', 'es', 'advanced')]
    expect(modalDifficulty(finished, 'es')).toBeNull()
  })
})

describe('computeNextPick', () => {
  it('returns null for an empty queue', () => {
    expect(computeNextPick({ queue: [], today: TODAY })).toBeNull()
  })

  it('falls back to the queue front with a queue-top reason', () => {
    const queue = [book('a', 'fr'), book('b', 'fr')]
    const pick = computeNextPick({ queue, today: TODAY })
    expect(pick.kind).toBe('queue-top')
    expect(pick.book).toBe(queue[0])
    expect(pick.reason).toBe('Next in line — you queued it yourself.')
  })

  it('picks a short book when one is at or under the limit', () => {
    const queue = [book('a', 'fr'), book('b', 'fr', { totalPages: SHORT_PAGE_LIMIT })]
    const pick = computeNextPick({ queue, today: TODAY })
    expect(pick.kind).toBe('short')
    expect(pick.book.id).toBe('b')
    expect(pick.reason).toContain(`${SHORT_PAGE_LIMIT} pages`)
  })

  it('skips the short rung when every page count is missing (no crash)', () => {
    const queue = [book('a', 'fr'), book('b', 'fr', { totalPages: 0 })]
    expect(computeNextPick({ queue, today: TODAY }).kind).toBe('queue-top')
  })

  it('skips the short rung when the shortest known book is still long', () => {
    const queue = [book('a', 'fr', { totalPages: SHORT_PAGE_LIMIT + 1 })]
    expect(computeNextPick({ queue, today: TODAY }).kind).toBe('queue-top')
  })

  it('surfaces a neglected language with a queued book', () => {
    const pick = computeNextPick({
      queue: [book('a', 'es'), book('b', 'fr')],
      entries: [entry('french', 9), entry('spanish', 0)],
      languages: [FRENCH, SPANISH],
      today: TODAY,
    })
    expect(pick.kind).toBe('neglected')
    expect(pick.book.id).toBe('b')
    expect(pick.reason).toBe('Time to water your French — 9 days since your last session.')
  })

  it('composes the reason when the neglected language also has a short book', () => {
    const pick = computeNextPick({
      queue: [book('a', 'fr', { totalPages: 400 }), book('b', 'fr', { totalPages: 150 })],
      entries: [entry('french', 9)],
      languages: [FRENCH],
      today: TODAY,
    })
    expect(pick.kind).toBe('neglected')
    expect(pick.book.id).toBe('b')
    expect(pick.reason).toBe("A short win in French — you haven't watered it in 9 days.")
  })

  it('falls back to the neglected language’s queue-order top when its short books are long', () => {
    const pick = computeNextPick({
      queue: [book('a', 'fr', { totalPages: 900 }), book('b', 'fr', { totalPages: 500 })],
      entries: [entry('french', 9)],
      languages: [FRENCH],
      today: TODAY,
    })
    expect(pick.kind).toBe('neglected')
    expect(pick.book.id).toBe('a')
  })

  it('suppresses the neglected rung when a Reading book already covers the language', () => {
    const pick = computeNextPick({
      queue: [book('b', 'fr')],
      activeBooks: [book('r', 'fr', { status: 'reading' })],
      entries: [entry('french', 9)],
      languages: [FRENCH],
      today: TODAY,
    })
    expect(pick.kind).toBe('queue-top')
  })

  it('ignores languages neglected for fewer than NEGLECT_DAYS', () => {
    const pick = computeNextPick({
      queue: [book('b', 'fr')],
      entries: [entry('french', NEGLECT_DAYS - 1)],
      languages: [FRENCH],
      today: TODAY,
    })
    expect(pick.kind).toBe('queue-top')
  })

  it('prefers the most-neglected language when several qualify', () => {
    const pick = computeNextPick({
      queue: [book('a', 'es'), book('b', 'fr')],
      entries: [entry('french', 21), entry('spanish', 9)],
      languages: [FRENCH, SPANISH],
      today: TODAY,
    })
    expect(pick.book.id).toBe('b')
  })

  it('neglected beats short beats difficulty', () => {
    const finished = [
      book('f1', 'es', { status: 'read', difficulty: 'intermediate' }),
      book('f2', 'es', { status: 'read', difficulty: 'intermediate' }),
    ]
    const queue = [
      book('level', 'es', { difficulty: 'intermediate' }),
      book('short', 'es', { totalPages: 100 }),
      book('nudge', 'fr'),
    ]
    const base = { queue, finishedBooks: finished, languages: [FRENCH, SPANISH], today: TODAY }

    // All three signals present → neglected wins.
    const all = computeNextPick({ ...base, entries: [entry('french', 9), entry('spanish', 0)] })
    expect(all.kind).toBe('neglected')

    // No neglect → short wins over difficulty.
    const noNeglect = computeNextPick({ ...base, entries: [entry('french', 0), entry('spanish', 0)] })
    expect(noNeglect.kind).toBe('short')
    expect(noNeglect.book.id).toBe('short')
  })

  it('matches a queued book to the user’s proven difficulty level', () => {
    const finished = [
      book('f1', 'es', { status: 'read', difficulty: 'intermediate' }),
      book('f2', 'es', { status: 'read', difficulty: 'intermediate' }),
      book('f3', 'es', { status: 'read', difficulty: 'advanced' }),
    ]
    const pick = computeNextPick({
      queue: [book('a', 'es', { difficulty: 'advanced' }), book('b', 'es', { difficulty: 'intermediate' })],
      finishedBooks: finished,
      today: TODAY,
    })
    expect(pick.kind).toBe('difficulty')
    expect(pick.book.id).toBe('b')
    expect(pick.reason).toBe("Right at your level — you've finished 2 intermediate books in Spanish.")
  })
})
