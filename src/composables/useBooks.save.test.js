// End-to-end saveBook test. Mocks Supabase and walks the full save flow to
// verify: (a) the upsert payloads are correct, (b) the in-memory savedBooks
// ends up with a usable book, (c) the useShelves computed picks it up.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

const upsertCalls = []
const updateCalls = []
const insertCalls = []

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: {} } }) },
    from: (table) => ({
      upsert: (payload) => {
        upsertCalls.push({ table, payload })
        return Promise.resolve({ error: null })
      },
      update: (payload) => {
        const chain = {
          eq: () => chain,
          then: (r) => {
            updateCalls.push({ table, payload })
            return Promise.resolve({ error: null }).then(r)
          },
        }
        return chain
      },
      insert: (payload) => {
        insertCalls.push({ table, payload })
        return Promise.resolve({ error: null })
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}))

vi.mock('./useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }))
vi.mock('./useAuth.js', () => ({ useAuth: () => ({ userId: ref('u1') }) }))

import { useBooks } from './useBooks.js'
import { useShelves } from './useShelves.js'

describe('saveBook — end-to-end', () => {
  let _reset
  beforeEach(async () => {
    upsertCalls.length = 0
    updateCalls.length = 0
    insertCalls.length = 0
    // `savedBooks` is a module-level ref so it persists across tests. Each
    // test grabs a fresh composable and uses the returned `savedBooks` ref
    // to reset the state.
    const { savedBooks } = useBooks()
    savedBooks.value = []
    await nextTick()
  })

  it('saving a "want_to_read" book from search results in an Up-next shelf entry', async () => {
    const { savedBooks, saveBook } = useBooks()
    const { queue, active, finished } = useShelves()

    // Initial state: empty
    expect(queue.value).toEqual([])
    expect(active.value).toEqual([])
    expect(finished.value).toEqual([])

    // Simulate saving a book from search
    const volume = {
      externalId: 'goog-abc',
      title: 'Le Petit Prince',
      author: 'Saint-Exupéry',
      coverUrl: 'https://example.com/cover.jpg',
      description: 'A young prince travels the universe.',
      languageCode: 'fr',
      pageCount: 96,
      publishedDate: '1943',
    }
    const record = {
      targetLanguage: 'fr',
      status: 'want_to_read',
      rating: null,
      difficulty: null,
      notes: null,
      startedAt: null,
      totalPages: 96,
      currentPage: 0,
    }

    await saveBook(volume, record)
    await nextTick()

    // Verify Supabase calls
    expect(upsertCalls).toHaveLength(2)
    const bookUpsert = upsertCalls.find((c) => c.table === 'books')
    const recordUpsert = upsertCalls.find((c) => c.table === 'reading_records')
    expect(bookUpsert).toBeDefined()
    expect(recordUpsert).toBeDefined()

    // Verify book payload
    expect(bookUpsert.payload.id).toBeDefined()
    expect(bookUpsert.payload.external_id).toBe('goog-abc')
    expect(bookUpsert.payload.title).toBe('Le Petit Prince')
    expect(bookUpsert.payload.language_code).toBe('fr')
    expect(bookUpsert.payload.user_id).toBe('u1')

    // Verify record payload
    expect(recordUpsert.payload.book_id).toBe(bookUpsert.payload.id)
    expect(recordUpsert.payload.target_language).toBe('fr')
    expect(recordUpsert.payload.status).toBe('want_to_read')
    expect(recordUpsert.payload.total_pages).toBe(96)
    expect(recordUpsert.payload.user_id).toBe('u1')
    expect(recordUpsert.payload.added_to_queue_at).toBeDefined()

    // Verify in-memory state
    expect(savedBooks.value).toHaveLength(1)
    const saved = savedBooks.value[0]
    expect(saved.externalId).toBe('goog-abc')
    expect(saved.title).toBe('Le Petit Prince')
    expect(saved.languageCode).toBe('fr')
    expect(saved.record).toBeDefined()
    expect(saved.record.status).toBe('want_to_read')

    // Verify the shelves see it
    expect(queue.value).toHaveLength(1)
    expect(queue.value[0].id).toBe(saved.id)
    expect(active.value).toHaveLength(0)
    expect(finished.value).toHaveLength(0)
  })

  it('saving a "read" book lands in the Finished shelf', async () => {
    const { savedBooks, saveBook } = useBooks()
    const { queue, active, finished } = useShelves()

    const volume = {
      externalId: 'goog-finished',
      title: 'Madame Bovary',
      author: 'Flaubert',
      coverUrl: null,
      description: null,
      languageCode: 'fr',
      pageCount: 400,
      publishedDate: '1856',
    }
    await saveBook(volume, {
      targetLanguage: 'fr',
      status: 'read',
      rating: 4.5,
      difficulty: 'intermediate',
      notes: 'Brilliant.',
      startedAt: '2026-06-01',
      finishedAt: '2026-07-01',
      totalPages: 400,
      currentPage: 400,
    })
    await nextTick()

    expect(savedBooks.value).toHaveLength(1)
    expect(finished.value).toHaveLength(1)
    expect(queue.value).toHaveLength(0)
    expect(active.value).toHaveLength(0)
  })

  it('saving a "reading" book lands in the Active shelf', async () => {
    const { savedBooks, saveBook } = useBooks()
    const { queue, active, finished } = useShelves()

    const volume = {
      externalId: 'goog-reading',
      title: 'L\'Étranger',
      author: 'Camus',
      coverUrl: null,
      description: null,
      languageCode: 'fr',
      pageCount: 200,
    }
    await saveBook(volume, {
      targetLanguage: 'fr',
      status: 'reading',
      rating: null,
      difficulty: null,
      notes: null,
      startedAt: '2026-07-01',
      totalPages: 200,
      currentPage: 30,
    })
    await nextTick()

    expect(savedBooks.value).toHaveLength(1)
    expect(active.value).toHaveLength(1)
    expect(queue.value).toHaveLength(0)
    expect(finished.value).toHaveLength(0)
  })
})
