import { ref, computed, watch } from 'vue'
import {
  searchBooksMerged,
  sortBooks,
  applyFilters,
} from '../lib/bookSearch.js'
import { getRecentSearches, pushRecentSearch, clearRecentSearches } from '../lib/searchCache.js'
import { useAuth } from './useAuth.js'

const PAGE_SIZE = 20

// Search UI state for the Library tab. The composable owns:
//   - the debounced first-search lifecycle (token-guarded against out-of-order
//     responses),
//   - the in-memory merged result set, with append-on-loadMore + dedupe,
//   - the secondary filter + sort state, applied in-memory so flipping a chip
//     never round-trips to the network,
//   - the recent-search history (per-user localStorage).
// The parent's `useBooks` provides the saved-book set, so the "Already saved"
// filter and the "Saved" badge on result cards can read from one source of
// truth.
export function useBookSearch({ savedExternalIds = () => new Set() } = {}) {
  const { userId } = useAuth()

  // ── Query state ────────────────────────────────────────────────────────
  const query = ref('')
  const languageCode = ref(null)
  const results = ref([])
  const sources = ref(new Set())
  const sort = ref('relevance')
  const filters = ref({
    pageRange: null,
    hasDescription: false,
    hasPageCount: false,
    alreadySaved: false,
  })

  // ── Lifecycle ──────────────────────────────────────────────────────────
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref(false)
  const hasSearched = ref(false)
  const hasMore = ref(false)
  const page = ref(0)

  let debounceTimer = null
  let requestToken = 0

  // ── Recent searches ────────────────────────────────────────────────────
  const recent = ref(getRecentSearches(userId.value))
  watch(userId, (id) => { recent.value = getRecentSearches(id) })

  // ── Filtered + sorted view (computed over `results`) ───────────────────
  const filteredResults = computed(() =>
    sortBooks(applyFilters(results.value, {
      ...filters.value,
      savedExternalIds: savedExternalIds(),
    }), sort.value)
  )

  function resetResults() {
    results.value = []
    sources.value = new Set()
    hasMore.value = false
    page.value = 0
    hasSearched.value = false
    error.value = false
  }

  // Run a fetch. Pass `append: true` to load the next page (keeps the existing
  // results and dedupes the new batch against them). Pass `append: false` (the
  // default) for a fresh search — wipes the result set first.
  async function run({ append = false } = {}) {
    const q = query.value.trim()
    if (!q) {
      resetResults()
      return
    }
    const nextPage = append ? page.value + 1 : 1
    const token = ++requestToken
    if (append) {
      loadingMore.value = true
    } else {
      loading.value = true
    }
    error.value = false
    try {
      const res = await searchBooksMerged({ query: q, languageCode: languageCode.value, page: nextPage, pageSize: PAGE_SIZE })
      if (token !== requestToken) return
      if (append) {
        // Dedupe the new batch against the existing in-memory set. Sort/filter
        // is reapplied by the computed `filteredResults`, so we just append
        // raw merged books here.
        const existing = new Set(results.value.map((b) => b.externalId))
        const fresh = res.books.filter((b) => !existing.has(b.externalId))
        results.value = results.value.concat(fresh)
      } else {
        results.value = res.books
        // Only persist to the recent-search list on a brand-new search.
        if (q) {
          recent.value = pushRecentSearch(userId.value, q)
        }
      }
      sources.value = res.sources
      hasMore.value = res.hasMore
      page.value = nextPage
      hasSearched.value = true
    } catch (e) {
      if (token !== requestToken) return
      error.value = true
      if (!append) results.value = []
    } finally {
      if (token === requestToken) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  // Debounced — call on input / language change / sort / filter change for
  // a brand-new search. The debounce only applies to the first search; sort
  // and filter flips don't need it.
  const search = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => run({ append: false }), 350)
  }

  // Immediate — call on Enter / explicit submit.
  const searchNow = () => {
    clearTimeout(debounceTimer)
    run({ append: false })
  }

  // "Show more" — appends the next page. No debounce (user explicitly clicked).
  const loadMore = () => {
    if (loadingMore.value || !hasMore.value) return
    run({ append: true })
  }

  const setLanguage = (code) => {
    languageCode.value = code || null
    searchNow()
  }

  // Sort and filter flips are pure in-memory — no fetch needed, but a new
  // search restarts pagination, so reset the result set first.
  function setSort(next) {
    sort.value = next || 'relevance'
  }
  function setFilter(key, value) {
    filters.value = { ...filters.value, [key]: value }
  }
  function clearFilters() {
    filters.value = {
      pageRange: null,
      hasDescription: false,
      hasPageCount: false,
      alreadySaved: false,
    }
  }

  function clearRecent() {
    clearRecentSearches(userId.value)
    recent.value = []
  }

  // Cancel any pending debounced search (call on component unmount).
  const cleanup = () => {
    clearTimeout(debounceTimer)
  }

  return {
    // query state
    query,
    languageCode,
    results,
    filteredResults,
    sources,
    sort,
    filters,
    // lifecycle
    loading,
    loadingMore,
    error,
    hasSearched,
    hasMore,
    page,
    // actions
    search,
    searchNow,
    loadMore,
    setLanguage,
    setSort,
    setFilter,
    clearFilters,
    cleanup,
    // recent
    recent,
    clearRecent,
  }
}
