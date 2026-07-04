// Race condition test: a user who signs in and immediately saves a book
// before the initial loadBooks() returns. The slow loadBooks() could
// overwrite the in-memory state with stale data, "losing" the saved book.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

let dbPromise
let dbResolve
let upsertCalls = []

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: {} } }) },
    from: (table) => {
      if (table === 'books') {
        return {
          upsert: (payload) => {
            upsertCalls.push({ table, payload })
            return Promise.resolve({ error: null })
          },
          select: () => ({
            eq: () => ({
              order: () => dbPromise,
            }),
          }),
        }
      }
      if (table === 'reading_records') {
        return {
          upsert: (payload) => {
            upsertCalls.push({ table, payload })
            return Promise.resolve({ error: null })
          },
          select: () => ({
            eq: () => dbPromise,
          }),
        }
      }
      return {
        upsert: () => Promise.resolve({ error: null }),
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
    },
  },
}))

const userIdRef = ref(null)
vi.mock('./useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }))
vi.mock('./useAuth.js', () => ({ useAuth: () => ({ userId: userIdRef }) }))

// Re-import useBooks so it picks up the mocks and runs the watch on userId.
import { useBooks } from './useBooks.js'
import { useShelves } from './useShelves.js'

describe('race: initial loadBooks vs fast save', () => {
  beforeEach(() => {
    upsertCalls = []
    dbPromise = new Promise((resolve) => {
      dbResolve = (data) => resolve({ data, error: null })
    })
    userIdRef.value = null
  })

  it('a save before the initial loadBooks resolves is not lost when loadBooks overwrites with empty data', async () => {
    // 1. User is signed in
    userIdRef.value = 'u1'
    await nextTick()
    // First useBooks() call kicks off the watch → loadBooks() (still pending)
    const { savedBooks, saveBook } = useBooks()
    const { queue, active, finished } = useShelves()

    // Initial state: empty (load hasn't returned yet)
    expect(savedBooks.value).toEqual([])

    // 2. User saves a book BEFORE loadBooks resolves
    const volume = {
      externalId: 'goog-abc',
      title: 'Le Petit Prince',
      author: 'Saint-Exupéry',
      coverUrl: 'https://example.com/cover.jpg',
      description: null,
      languageCode: 'fr',
      pageCount: 96,
    }
    await saveBook(volume, {
      targetLanguage: 'fr',
      status: 'want_to_read',
      rating: null,
      difficulty: null,
      notes: null,
      startedAt: null,
      totalPages: 96,
      currentPage: 0,
    })
    await nextTick()

    // After save: in-memory has the book, shelves see it
    expect(savedBooks.value).toHaveLength(1)
    expect(queue.value).toHaveLength(1)

    // 3. Now the initial loadBooks resolves with empty data (no existing books)
    dbResolve([])
    await nextTick()
    await nextTick()

    // BUG: loadBooks overwrites with empty data, losing the saved book
    expect(savedBooks.value).toHaveLength(1)
    expect(queue.value).toHaveLength(1)
  })

  it('a save during initial load preserves the new book when DB returns other books too', async () => {
    userIdRef.value = 'u1'
    await nextTick()
    const { savedBooks, saveBook } = useBooks()
    savedBooks.value = []  // reset module state from prior test
    const { queue } = useShelves()

    // Save a new book BEFORE loadBooks resolves
    await saveBook(
      { externalId: 'new-1', title: 'New Book', author: null, coverUrl: null, description: null, languageCode: 'fr', pageCount: null },
      { targetLanguage: 'fr', status: 'want_to_read', rating: null, difficulty: null, notes: null, startedAt: null, totalPages: null, currentPage: 0 }
    )
    await nextTick()
    expect(savedBooks.value).toHaveLength(1)
    const newBookId = savedBooks.value[0].id

    // Now loadBooks resolves with a different book in the DB (the snapshot
    // was taken before the save, so the new book isn't in it)
    dbResolve([
      { id: 'db-old-1', external_id: 'old-1', title: 'Old Book', author: 'A', cover_url: null, description: null, language_code: 'fr', created_at: '2026-06-01', updated_at: '2026-06-01' },
    ])
    await nextTick()
    await nextTick()

    // Both books present
    expect(savedBooks.value).toHaveLength(2)
    const ids = savedBooks.value.map((b) => b.id)
    expect(ids).toContain('db-old-1')
    expect(ids).toContain(newBookId)
    expect(queue.value.find((b) => b.id === newBookId)).toBeDefined()
  })

  it('a no-op merge when DB and memory are in sync', async () => {
    userIdRef.value = 'u1'
    await nextTick()
    const { savedBooks } = useBooks()
    savedBooks.value = []  // reset module state from prior test

    // loadBooks resolves with empty, in-memory is empty
    dbResolve([])
    await nextTick()
    await nextTick()
    expect(savedBooks.value).toEqual([])
  })
})
