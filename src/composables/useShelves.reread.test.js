// End-to-end tests for the startReread action. The composable's reactive
// shape (real savedBooks + a real atActiveCap computed) is what carries the
// cap-prompt contract, so we mount the real wiring against a mocked
// supabase / useToast / useAuth / useBooks — same pattern as the reorder
// tests. shelfSort.test.js covers the pure helpers; this file proves the
// "Finished → Reading" transition the user just asked for.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

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

const savedBooks = ref([])
const updateRecord = vi.fn(async (bookId, updates) => ({ bookId, updates }))
vi.mock('./useBooks.js', () => ({
  useBooks: () => ({ savedBooks, persist: vi.fn(), updateRecord }),
}))

import { useShelves, ACTIVE_CAP } from './useShelves.js'

// Helper to build a finished book with realistic record fields.
const finished = (id, over = {}) => ({
  id,
  languageCode: 'fr',
  record: {
    status: 'read',
    startedAt: '2026-05-01',
    finishedAt: '2026-05-20',
    currentPage: 240,
    totalPages: 240,
    ...over,
  },
})
const reading = (id) => ({
  id,
  languageCode: 'fr',
  record: { status: 'reading', startedAt: '2026-06-01', currentPage: 50, totalPages: 300 },
})

describe('useShelves startReread', () => {
  beforeEach(() => {
    savedBooks.value = []
    updateRecord.mockClear()
  })

  it('transitions a finished book to reading and resets the read-through', async () => {
    savedBooks.value = [finished('b1')]
    const { startReread } = useShelves()
    const result = await startReread('b1')
    expect(result.needsConfirmation).toBe(false)
    expect(updateRecord).toHaveBeenCalledTimes(1)
    const [bookId, updates] = updateRecord.mock.calls[0]
    expect(bookId).toBe('b1')
    expect(updates.status).toBe('reading')
    expect(updates.finishedAt).toBeNull()
    expect(updates.currentPage).toBe(0)
    // startedAt is a fresh stamp, not a copy of the prior read-through.
    expect(updates.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(updates.startedAt).not.toBe('2026-05-01')
    // totalPages is intentionally NOT touched — the book itself doesn't change.
    expect(updates).not.toHaveProperty('totalPages')
  })

  it('keeps totalPages intact so the progress bar reads sensibly as the re-read progresses', async () => {
    // The user already has a finished book with 240 pages. They re-read it
    // from the start; totalPages stays at 240, currentPage resets to 0, and
    // the next page-log will read 1/240, 2/240, etc. The re-read should
    // never leave the book looking "smaller" than it is.
    savedBooks.value = [finished('b1', { totalPages: 240 })]
    const { startReread } = useShelves()
    await startReread('b1')
    const updates = updateRecord.mock.calls[0][1]
    expect(updates).not.toHaveProperty('totalPages')
    // The original totalPages must be visible to the caller — in-memory state
    // is mutated by updateRecord, and the book still has it.
    expect(savedBooks.value[0].record.totalPages).toBe(240)
  })

  it('returns { needsConfirmation: true } when the reading cap is hit', async () => {
    // Three active books fill the cap. A fourth (re-read) needs confirmation.
    savedBooks.value = [
      reading('r1'), reading('r2'), reading('r3'),
      finished('b1'),
    ]
    const { startReread } = useShelves()
    const result = await startReread('b1')
    expect(result.needsConfirmation).toBe(true)
    expect(result.count).toBe(ACTIVE_CAP)
    expect(updateRecord).not.toHaveBeenCalled()
  })

  it('force-bypasses the cap when { force: true } is passed', async () => {
    savedBooks.value = [reading('r1'), reading('r2'), reading('r3'), finished('b1')]
    const { startReread } = useShelves()
    const result = await startReread('b1', { force: true })
    expect(result.needsConfirmation).toBe(false)
    expect(updateRecord).toHaveBeenCalledTimes(1)
    expect(updateRecord.mock.calls[0][0]).toBe('b1')
  })

  it('returns an error for a book id that is not in the library', async () => {
    savedBooks.value = [finished('b1')]
    const { startReread } = useShelves()
    const result = await startReread('does-not-exist')
    expect(result).toEqual({ error: 'Book not found' })
    expect(updateRecord).not.toHaveBeenCalled()
  })

  it('does not move other shelves — the cap check is live', async () => {
    // Two active books means there's room; the cap check should let startReread
    // through without a prompt, and the other shelves should not be touched.
    savedBooks.value = [reading('r1'), reading('r2'), finished('b1')]
    const { startReread, active, queue, finished: finShelf } = useShelves()
    await nextTick()
    expect(active.value.map((b) => b.id)).toEqual(['r1', 'r2'])
    expect(queue.value).toEqual([])
    expect(finShelf.value.map((b) => b.id)).toEqual(['b1'])
    const result = await startReread('b1')
    expect(result.needsConfirmation).toBe(false)
    expect(updateRecord).toHaveBeenCalledTimes(1)
  })
})
