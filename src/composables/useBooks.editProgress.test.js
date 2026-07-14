// Editing a book's "Current page" directly (Edit book modal) should count as
// real reading progress — without this, pace/last-read on the Reading
// spotlight card go stale forever after an edit, even though the page count
// itself just advanced. Regression test for that gap.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

const progressInserts = []
const recordUpdates = []

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: {} } }) },
    from: (table) => {
      if (table === 'reading_progress') {
        return {
          // Bulk history load (loadAllProgress) — empty so progressLoaded
          // still flips true without needing real rows.
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          insert: (payload) => {
            progressInserts.push(payload)
            return {
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: `p${progressInserts.length}`, created_at: '2026-07-15T10:00:00Z' },
                  error: null,
                }),
              }),
            }
          },
        }
      }
      if (table === 'reading_records') {
        return {
          update: (payload) => {
            const chain = {
              eq: () => chain,
              then: (resolve) => {
                recordUpdates.push(payload)
                return Promise.resolve({ error: null }).then(resolve)
              },
            }
            return chain
          },
        }
      }
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      }
    },
  },
}))

vi.mock('./useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }))
vi.mock('./useAuth.js', () => ({ useAuth: () => ({ userId: ref('u1') }) }))

import { useBooks } from './useBooks.js'

function book(overrides = {}) {
  return {
    id: 'b1',
    externalId: 'ext-1',
    title: 'Damals im Sommer',
    author: 'Florian Gottschick',
    languageCode: 'de',
    record: { currentPage: 87, totalPages: 204, status: 'reading', ...overrides },
  }
}

describe('updateRecord — manual page-count edits log a session', () => {
  beforeEach(async () => {
    progressInserts.length = 0
    recordUpdates.length = 0
    const { savedBooks, readingProgress } = useBooks()
    // Let the initial loadBooks()/loadAllProgress() (kicked off by the
    // immediate userId watch) settle before seeding — otherwise their
    // resolution can clobber the seed applied here, same race useBooks.save
    // .test.js guards against.
    await nextTick()
    savedBooks.value = [book()]
    readingProgress.value = []
  })

  it('inserts a reading_progress row when the edited page count advances', async () => {
    const { updateRecord, readingProgress } = useBooks()
    await updateRecord('b1', { currentPage: 112, totalPages: 204 })

    expect(progressInserts).toHaveLength(1)
    expect(progressInserts[0]).toMatchObject({
      book_id: 'b1',
      pages_read: 25, // 112 - 87
      from_page: 88,
      to_page: 112,
    })
    // The bulk-loaded history the spotlight card reads pace/last-read from
    // must reflect the new row immediately, no reload required.
    expect(readingProgress.value).toHaveLength(1)
    expect(readingProgress.value[0]).toMatchObject({ bookId: 'b1', pagesRead: 25 })
  })

  it('does not log a session when the page count is unchanged', async () => {
    const { updateRecord } = useBooks()
    await updateRecord('b1', { status: 'reading', notes: 'still going' })
    expect(progressInserts).toHaveLength(0)
  })

  it('does not log a session when the page count decreases (a correction, not progress)', async () => {
    const { updateRecord } = useBooks()
    await updateRecord('b1', { currentPage: 40, totalPages: 204 })
    expect(progressInserts).toHaveLength(0)
  })
})
