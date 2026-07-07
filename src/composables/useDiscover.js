import { ref } from 'vue'
import { useAuth } from './useAuth.js'
import { buildDiscoverSeeds } from '../lib/discover.js'
import { searchBooksMerged } from '../lib/bookSearch.js'
import { getDiscoverRow, setDiscoverRow, pruneDiscoverRows } from '../lib/discoverCache.js'

// Gap between row fetches so a cold load never fires MAX_ROWS parallel
// requests at the keyless Google Books quota.
const STAGGER_MS = 500

// Discover-row state for the Library. Per-mount (not a singleton): the 24h
// row cache in discoverCache.js makes a remount essentially free, so there's
// nothing worth sharing across instances.
//
// `rows` holds the RAW fetched list per seed (books: null while unresolved).
// The component applies saved/cross-row filtering at render time via
// filterRowBooks — that way saving a book hides it from every row instantly
// without invalidating any cache entry.
export function useDiscover() {
  const { userId } = useAuth()

  const rows = ref([])
  let requestToken = 0

  async function load({ savedBooks = [], entries = [], languages = [] } = {}) {
    const token = ++requestToken
    const uid = userId.value
    const seeds = buildDiscoverSeeds({ savedBooks, entries, languages })
    pruneDiscoverRows(uid, seeds.map((s) => s.key))

    // Cache-first: hits render immediately, misses show nothing until their
    // staggered fetch resolves (rows appear as they arrive).
    rows.value = seeds.map((seed) => {
      const cached = getDiscoverRow(uid, seed.key)
      return { seed, books: cached, loading: cached === null }
    })

    for (const row of rows.value) {
      if (row.books !== null) continue
      if (token !== requestToken) return
      try {
        const { books, error } = await searchBooksMerged({
          query: row.seed.query,
          languageCode: row.seed.languageCode,
          page: 1,
          pageSize: 20,
        })
        if (token !== requestToken) return
        row.books = books
        // Don't cache a total failure — the next mount should get to retry.
        if (!error) setDiscoverRow(uid, row.seed.key, books)
      } catch (e) {
        if (token !== requestToken) return
        row.books = [] // silent collapse; discovery is additive
      } finally {
        if (token === requestToken) row.loading = false
      }
      await new Promise((resolve) => setTimeout(resolve, STAGGER_MS))
    }
  }

  // Invalidate any in-flight staggered fetches (call on unmount).
  function cleanup() {
    requestToken++
  }

  return { rows, load, cleanup }
}
