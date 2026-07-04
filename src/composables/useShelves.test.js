import { describe, it, expect } from 'vitest'
import { sortActive, sortQueue, sortFinished, nextSwapIndices } from '../lib/shelfSort.js'

const book = (id, record = {}) => ({
  id,
  title: `Book ${id}`,
  author: 'A',
  coverUrl: null,
  languageCode: 'fr',
  record: { status: 'want_to_read', ...record },
})

describe('sortActive', () => {
  it('sorts by startedAt desc', () => {
    const a = book('a', { status: 'reading', startedAt: '2026-01-01' })
    const b = book('b', { status: 'reading', startedAt: '2026-02-01' })
    expect(sortActive([a, b]).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('breaks ties by currentPage desc', () => {
    const a = book('a', { status: 'reading', startedAt: '2026-01-01', currentPage: 10 })
    const b = book('b', { status: 'reading', startedAt: '2026-01-01', currentPage: 30 })
    expect(sortActive([a, b]).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const a = book('a', { status: 'reading', startedAt: '2026-01-01' })
    const b = book('b', { status: 'reading', startedAt: '2026-02-01' })
    const orig = [a, b]
    sortActive(orig)
    expect(orig.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('sortQueue', () => {
  it('sorts by sortIndex asc when set', () => {
    const a = book('a', { sortIndex: 20 })
    const b = book('b', { sortIndex: 10 })
    expect(sortQueue([a, b]).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('places sorted rows before unsorted ones', () => {
    const a = book('a')  // no sortIndex
    const b = book('b', { sortIndex: 5 })
    expect(sortQueue([a, b]).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('falls back to addedToQueueAt desc when no sortIndex is set', () => {
    const a = book('a', { addedToQueueAt: '2026-01-01T00:00:00Z' })
    const b = book('b', { addedToQueueAt: '2026-02-01T00:00:00Z' })
    expect(sortQueue([a, b]).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('sortFinished', () => {
  it('sorts by finishedAt desc', () => {
    const a = book('a', { status: 'read', finishedAt: '2026-01-15' })
    const b = book('b', { status: 'read', finishedAt: '2026-03-10' })
    expect(sortFinished([a, b]).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('nextSwapIndices', () => {
  it('returns null when either id is missing', () => {
    const a = book('a', { sortIndex: 5 })
    expect(nextSwapIndices([a], 'a', 'zzz', 'up')).toBeNull()
  })

  it('mints baseline integers when neither row has a sortIndex', () => {
    const a = book('a')
    const b = book('b')
    const out = nextSwapIndices([a, b], 'a', 'b', 'up')
    // a is at index 0 → 0*10=0, b is at index 1 → 1*10=10
    expect(out).toEqual({ a: 0, b: 10 })
  })

  it('inserts an unsorted row one step above a sorted neighbour', () => {
    const a = book('a')          // unsorted
    const b = book('b', { sortIndex: 10 })
    const out = nextSwapIndices([a, b], 'a', 'b', 'up')
    // a is moving up, lands just above b → 10 - 1 = 9
    expect(out).toEqual({ a: 9 })
  })

  it('inserts an unsorted row one step below a sorted neighbour', () => {
    const a = book('a')          // unsorted
    const b = book('b', { sortIndex: 10 })
    const out = nextSwapIndices([a, b], 'a', 'b', 'down')
    expect(out).toEqual({ a: 11 })
  })

  it('swaps two sorted rows', () => {
    const a = book('a', { sortIndex: 5 })
    const b = book('b', { sortIndex: 10 })
    const out = nextSwapIndices([a, b], 'a', 'b', 'up')
    expect(out).toEqual({ a: 10, b: 5 })
  })
})
