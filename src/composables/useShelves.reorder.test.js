// End-to-end reorder tests for the *reactive composable*, not the pure
// helpers. shelfSort.test.js already proves the init + swap math; these mount
// the real useShelves() wiring (a real reactive savedBooks ref + the async
// writeSortIndex + a live `queue` subscriber) against a mocked Supabase, which
// is where the actual Up-next bug lived: reorderQueue is async, and overlapping
// clicks used to interleave and corrupt the order. A single click always
// worked, so the pure-helper tests never caught it.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, watch, nextTick } from 'vue'

// Supabase update: resolves on the next microtask like a real network round
// trip, so overlapping calls actually interleave in the tests below.
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: {} } }) },
    from: () => ({
      update: () => {
        const c = { eq: () => c, then: (r) => Promise.resolve({ error: null }).then(r) }
        return c
      },
    }),
  },
}))
vi.mock('./useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }))
vi.mock('./useAuth.js', () => ({ useAuth: () => ({ userId: ref('u1') }) }))

// A real reactive savedBooks ref behind a mocked useBooks — exactly the shape
// useShelves reads and mutates in place via writeSortIndex.
const savedBooks = ref([])
vi.mock('./useBooks.js', () => ({
  useBooks: () => ({ savedBooks, persist: vi.fn(), updateRecord: vi.fn() }),
}))

import { useShelves } from './useShelves.js'

// Shape a freshly-saved want_to_read book: saveBook prepends it and sets
// neither sortIndex nor addedToQueueAt, so the whole fresh queue is "all null".
const mkFresh = (id) => ({ id, languageCode: 'fr', record: { status: 'want_to_read' } })

describe('useShelves reorderQueue — reactive composable', () => {
  beforeEach(() => { savedBooks.value = [] })

  it('a single ▲ click on a fresh (all-null) queue moves the book up exactly one', async () => {
    const { queue, reorderQueue } = useShelves()
    const stop = watch(queue, () => {}, { immediate: true }) // live subscriber
    savedBooks.value = [mkFresh('c'), mkFresh('b'), mkFresh('a')]
    await nextTick()
    expect(queue.value.map((x) => x.id)).toEqual(['c', 'b', 'a'])

    await reorderQueue('a', 'up')
    await nextTick()
    expect(queue.value.map((x) => x.id)).toEqual(['c', 'a', 'b'])
    stop()
  })

  it('two rapid ▲ clicks on a fresh (all-null) queue move the book up twice (re-entrancy)', async () => {
    // Regression: users tap ▲ repeatedly. Both clicks fire before the first's
    // async init+swap settles. Before the serialise fix the second call read a
    // half-updated queue and the second move was lost (result: c,a,b instead
    // of a,c,b), which is the "sometimes it doesn't move / jumps" report,
    // worst when the queue is all-null because that path has the most awaits.
    const { queue, reorderQueue } = useShelves()
    const stop = watch(queue, () => {}, { immediate: true })
    savedBooks.value = [mkFresh('c'), mkFresh('b'), mkFresh('a')]
    await nextTick()

    const p1 = reorderQueue('a', 'up')
    const p2 = reorderQueue('a', 'up') // fired without awaiting p1
    await Promise.all([p1, p2])
    await nextTick()

    expect(queue.value.map((x) => x.id)).toEqual(['a', 'c', 'b'])
    stop()
  })

  it('a language-filtered reorder swaps with the visible neighbour, not a hidden row', async () => {
    // Up-next order is F1, G1, F2 but the user is filtered to French, so they
    // see [F1, F2]. Clicking ▲ on F2 must put it above F1 in the French view;
    // before the fix it swapped with the hidden German book and did nothing.
    const { queue, reorderQueue } = useShelves()
    const stop = watch(queue, () => {}, { immediate: true })
    savedBooks.value = [
      { id: 'F1', languageCode: 'fr', record: { status: 'want_to_read', sortIndex: 10 } },
      { id: 'G1', languageCode: 'de', record: { status: 'want_to_read', sortIndex: 20 } },
      { id: 'F2', languageCode: 'fr', record: { status: 'want_to_read', sortIndex: 30 } },
    ]
    await nextTick()
    const frenchView = () => queue.value.filter((b) => b.languageCode === 'fr').map((b) => b.id)
    expect(frenchView()).toEqual(['F1', 'F2'])

    await reorderQueue('F2', 'up', frenchView())
    await nextTick()

    expect(frenchView()).toEqual(['F2', 'F1'])
    // the hidden German book keeps its slot between the two French books
    expect(queue.value.map((b) => b.id)).toEqual(['F2', 'G1', 'F1'])
    stop()
  })

  it('three rapid ▼ clicks walk a book cleanly to the bottom', async () => {
    const { queue, reorderQueue } = useShelves()
    const stop = watch(queue, () => {}, { immediate: true })
    savedBooks.value = [mkFresh('d'), mkFresh('c'), mkFresh('b'), mkFresh('a')]
    await nextTick()
    expect(queue.value.map((x) => x.id)).toEqual(['d', 'c', 'b', 'a'])

    // move 'd' (top) all the way down with three quick clicks
    const clicks = [reorderQueue('d', 'down'), reorderQueue('d', 'down'), reorderQueue('d', 'down')]
    await Promise.all(clicks)
    await nextTick()
    expect(queue.value.map((x) => x.id)).toEqual(['c', 'b', 'a', 'd'])
    stop()
  })
})
