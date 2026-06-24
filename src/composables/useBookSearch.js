import { ref } from 'vue'
import { searchBooks } from '../lib/bookSearch.js'

// Search UI state for the Library tab. Keeps the debounce + request lifecycle
// out of the components so they stay declarative. A request token guards
// against out-of-order responses (a slow earlier search resolving after a
// later one).
export function useBookSearch() {
  const query = ref('')
  const languageCode = ref(null)
  const results = ref([])
  const source = ref(null)
  const loading = ref(false)
  const error = ref(false)
  const hasSearched = ref(false)

  let debounceTimer = null
  let requestToken = 0

  const run = async () => {
    const q = query.value.trim()
    if (!q) {
      results.value = []
      source.value = null
      hasSearched.value = false
      error.value = false
      loading.value = false
      return
    }

    const token = ++requestToken
    loading.value = true
    error.value = false
    try {
      const { books, source: usedSource } = await searchBooks({ query: q, languageCode: languageCode.value })
      if (token !== requestToken) return // a newer search superseded this one
      results.value = books
      source.value = usedSource
      hasSearched.value = true
    } catch (e) {
      if (token !== requestToken) return
      error.value = true
      results.value = []
    } finally {
      if (token === requestToken) loading.value = false
    }
  }

  // Debounced — call on input / language change.
  const search = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(run, 350)
  }

  // Immediate — call on Enter / explicit submit.
  const searchNow = () => {
    clearTimeout(debounceTimer)
    run()
  }

  const setLanguage = (code) => {
    languageCode.value = code || null
    if (query.value.trim()) searchNow()
  }

  // Cancel any pending debounced search (call on component unmount).
  const cleanup = () => {
    clearTimeout(debounceTimer)
  }

  return {
    query,
    languageCode,
    results,
    source,
    loading,
    error,
    hasSearched,
    search,
    searchNow,
    setLanguage,
    cleanup,
  }
}
