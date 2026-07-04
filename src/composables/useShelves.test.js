import { describe, it, expect } from 'vitest'
import {
  sortActive,
  sortQueue,
  sortFinished,
  nextSwapIndices,
  initSortIndices,
} from '../lib/shelfSort.js'

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

describe('initSortIndices', () => {
  it('assigns 10-spaced integers in the current visual order', () => {
    const a = book('a')
    const b = book('b')
    const c = book('c')
    expect(initSortIndices([a, b, c])).toEqual({ a: 10, b: 20, c: 30 })
  })

  it('preserves the visual order regardless of each book\'s current sortIndex', () => {
    // Visual order (e.g. from sortQueue with mixed inputs) might have any
    // mix of sortIndex / null; init normalises the whole queue to its
    // current visual position so a subsequent swap is well-defined.
    const mixed = [
      book('a', { sortIndex: 20 }),
      book('b'),  // null
      book('c', { sortIndex: 10 }),
      book('d'),  // null
    ]
    expect(initSortIndices(mixed)).toEqual({ a: 10, b: 20, c: 30, d: 40 })
  })

  it('returns an empty object for an empty queue', () => {
    expect(initSortIndices([])).toEqual({})
  })
})

describe('nextSwapIndices', () => {
  it('returns null when either id is missing', () => {
    const a = book('a', { sortIndex: 5 })
    expect(nextSwapIndices([a], 'a', 'zzz')).toBeNull()
  })

  it('returns null when either row has a null sortIndex (caller must init first)', () => {
    // The composable guarantees the queue is fully indexed before calling
    // nextSwapIndices. If a caller forgets, the swap is rejected rather
    // than silently producing the wrong order.
    const a = book('a')  // null
    const b = book('b', { sortIndex: 10 })
    expect(nextSwapIndices([a, b], 'a', 'b')).toBeNull()
    expect(nextSwapIndices([a, book('x')], 'a', 'x')).toBeNull()
  })

  it('swaps two sorted rows', () => {
    const a = book('a', { sortIndex: 5 })
    const b = book('b', { sortIndex: 10 })
    expect(nextSwapIndices([a, b], 'a', 'b')).toEqual({ a: 10, b: 5 })
  })

  it('is direction-agnostic: a blind swap produces the correct order for both up and down', () => {
    // For "up": a is the book being moved (lower in the queue), b is the
    // neighbour being displaced (above a). After the swap, a has the
    // smaller index and lands above b — exactly what "up" wants.
    const a = book('a', { sortIndex: 30 })  // being moved up
    const b = book('b', { sortIndex: 20 })  // neighbour above
    const out = nextSwapIndices([a, b], 'a', 'b')
    expect(out).toEqual({ a: 20, b: 30 })

    // For "down": a is the book being moved (higher in the queue), b is
    // the neighbour below. After the swap, a has the larger index and
    // lands below b — exactly what "down" wants.
    const c = book('c', { sortIndex: 20 })  // being moved down
    const d = book('d', { sortIndex: 30 })  // neighbour below
    const out2 = nextSwapIndices([c, d], 'c', 'd')
    expect(out2).toEqual({ c: 30, d: 20 })
  })
})

describe('reorder flow (init + swap composition)', () => {
  // The composable's reorderQueue does two steps: (1) initialise the whole
  // queue if any row is null, (2) run a 2-row swap. These tests document
  // the end-to-end order of the resulting queue, which is the user-visible
  // behaviour the bug report described.

  function apply(books, init, swap) {
    // Simulate the composable: init writes sortIndex, then swap writes
    // sortIndex. Then sortQueue produces the visual order.
    const afterInit = books.map((b) => ({ ...b, record: { ...b.record, sortIndex: init[b.id] ?? b.record?.sortIndex } }))
    const afterSwap = afterInit.map((b) => swap[b.id] != null ? { ...b, record: { ...b.record, sortIndex: swap[b.id] } } : b)
    return sortQueue(afterSwap)
  }

  it('first reorder on an all-null queue: book at the bottom moves up by exactly one', () => {
    // Visual order: c (newest) > b > a (oldest). User clicks ▲ on a.
    const a = book('a', { addedToQueueAt: '2026-01-01' })
    const b = book('b', { addedToQueueAt: '2026-02-01' })
    const c = book('c', { addedToQueueAt: '2026-03-01' })
    const init = initSortIndices(sortQueue([a, b, c]))  // c=10, b=20, a=30
    const swap = nextSwapIndices(
      [{ ...a, record: { ...a.record, sortIndex: 30 } },
       { ...b, record: { ...b.record, sortIndex: 20 } },
       { ...c, record: { ...c.record, sortIndex: 10 } }],
      'a', 'b'
    )  // a=20, b=30
    const result = apply([a, b, c], init, swap).map((x) => x.id)
    // Expected: c at top, a (just moved up), b. C does NOT get pushed to
    // the bottom — the init step prevents the "opposite direction" bug.
    expect(result).toEqual(['c', 'a', 'b'])
  })

  it('mid-queue reorder across sorted/unsorted boundary: the moved book shifts by exactly one', () => {
    // User has 2 sorted books + 1 unsorted. The visual order is
    // [sorted pair] then [unsorted]. User clicks ▼ on the last sorted
    // book — it should swap with the unsorted one directly below.
    const a = book('a', { sortIndex: 10 })
    const b = book('b', { sortIndex: 20 })
    const c = book('c')  // null
    const init = initSortIndices(sortQueue([a, b, c]))  // a=10, b=20, c=30
    const swap = nextSwapIndices(
      [{ ...a, record: { ...a.record, sortIndex: 10 } },
       { ...b, record: { ...b.record, sortIndex: 20 } },
       { ...c, record: { ...c.record, sortIndex: 30 } }],
      'b', 'c'
    )  // b=30, c=20
    const result = apply([a, b, c], init, swap).map((x) => x.id)
    expect(result).toEqual(['a', 'c', 'b'])
  })
})
