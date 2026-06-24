import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { getCached, setCache } from '../lib/cache.js'
import { useToast } from './useToast.js'
import { useAuth } from './useAuth.js'

// Saved books + their 1:1 reading records. Mirrors useStorage.js: per-user
// Supabase reads scoped by user_id, a 30s localStorage cache, optimistic
// in-memory updates, and toast on failure.
//
// Cache namespace: cache.js keys everything as `garten_data_<x>`. useStorage
// owns `garten_data_<uid>`, so this composable passes `books_<uid>` to land on
// a separate `garten_data_books_<uid>` entry and avoid clobbering it.

function cacheKey(userId) {
  return `books_${userId}`
}

function bookToSnake(book) {
  return {
    id: book.id,
    external_id: book.externalId,
    title: book.title,
    author: book.author ?? null,
    cover_url: book.coverUrl ?? null,
    description: book.description ?? null,
    language_code: book.languageCode,
  }
}

function recordToSnake(record) {
  return {
    target_language: record.targetLanguage,
    status: record.status,
    rating: record.rating ?? null,
    difficulty: record.difficulty ?? null,
    notes: record.notes || null,
    saved_at: record.savedAt ?? null,
    started_at: record.startedAt ?? null,
    finished_at: record.finishedAt ?? null,
  }
}

// Join a book row with its reading-record row into one display object. The
// reading fields live under `.record` so book metadata and user data stay
// visually distinct (mirrors the two-table split).
function joinToCamel(bookRow, recordRow) {
  return {
    id: bookRow.id,
    externalId: bookRow.external_id,
    title: bookRow.title,
    author: bookRow.author ?? null,
    coverUrl: bookRow.cover_url ?? null,
    description: bookRow.description ?? null,
    languageCode: bookRow.language_code,
    record: recordRow
      ? {
          targetLanguage: recordRow.target_language,
          status: recordRow.status,
          rating: recordRow.rating ?? null,
          difficulty: recordRow.difficulty ?? null,
          notes: recordRow.notes ?? null,
          savedAt: recordRow.saved_at ?? null,
          startedAt: recordRow.started_at ?? null,
          finishedAt: recordRow.finished_at ?? null,
        }
      : null,
  }
}

export function useBooks() {
  const savedBooks = ref([])
  const loaded = ref(false)
  const loadError = ref(false)
  const { userId } = useAuth()
  const toast = useToast()

  const persist = () => setCache(cacheKey(userId.value), savedBooks.value)

  const loadBooks = async () => {
    if (!userId.value) {
      savedBooks.value = []
      loaded.value = false
      loadError.value = false
      return
    }

    const cached = getCached(cacheKey(userId.value))
    if (cached) {
      savedBooks.value = cached
      loaded.value = true
      loadError.value = false
      return
    }

    loadError.value = false
    try {
      const [booksRes, recordsRes] = await Promise.all([
        supabase.from('books').select('*').eq('user_id', userId.value).order('created_at', { ascending: false }),
        supabase.from('reading_records').select('*').eq('user_id', userId.value),
      ])
      if (booksRes.error) throw booksRes.error
      if (recordsRes.error) throw recordsRes.error

      const recordByBook = new Map((recordsRes.data || []).map((r) => [r.book_id, r]))
      savedBooks.value = (booksRes.data || []).map((b) => joinToCamel(b, recordByBook.get(b.id)))
      setCache(cacheKey(userId.value), savedBooks.value)
      loaded.value = true
    } catch (e) {
      loadError.value = true
      loaded.value = false
    }
  }

  watch(
    userId,
    (id) => {
      if (id) {
        loadBooks()
      } else {
        savedBooks.value = []
        loaded.value = false
      }
    },
    { immediate: true }
  )

  const findByExternalId = (externalId) =>
    savedBooks.value.find((b) => b.externalId === externalId)

  // Save (or re-save) a book with its reading record. Dedup mirrors
  // useStorage.addLanguage: if this external book is already saved, reuse its
  // stable `id` so the reading_record PK (user_id, book_id) updates instead of
  // creating a duplicate (NFR: saving twice updates, not creates).
  const saveBook = async (volume, record) => {
    if (!userId.value) return

    const existing = findByExternalId(volume.externalId)
    const id = existing?.id ?? crypto.randomUUID()
    const book = {
      id,
      externalId: volume.externalId,
      title: volume.title,
      author: volume.author ?? null,
      coverUrl: volume.coverUrl ?? null,
      description: volume.description ?? null,
      languageCode: volume.languageCode,
    }
    const fullRecord = {
      targetLanguage: record.targetLanguage ?? volume.languageCode,
      status: record.status,
      rating: record.rating ?? null,
      difficulty: record.difficulty ?? null,
      notes: record.notes ?? null,
      savedAt: existing?.record?.savedAt ?? new Date().toISOString().slice(0, 10),
      startedAt: record.startedAt ?? existing?.record?.startedAt ?? null,
      finishedAt: record.finishedAt ?? existing?.record?.finishedAt ?? null,
    }

    const { error: bookErr } = await supabase.from('books').upsert({
      ...bookToSnake(book),
      user_id: userId.value,
      updated_at: new Date().toISOString(),
    })
    if (bookErr) {
      toast.error('Failed to save book. Please try again.')
      return
    }

    const { error: recErr } = await supabase.from('reading_records').upsert({
      book_id: id,
      ...recordToSnake(fullRecord),
      user_id: userId.value,
      updated_at: new Date().toISOString(),
    })
    if (recErr) {
      toast.error('Failed to save reading details. Please try again.')
      return
    }

    const joined = { ...book, record: fullRecord }
    if (existing) {
      savedBooks.value = savedBooks.value.map((b) => (b.id === id ? joined : b))
    } else {
      savedBooks.value = [joined, ...savedBooks.value]
    }
    persist()
    toast.success(existing ? 'Book updated.' : 'Book saved to your library.')
  }

  // FR10 — update status / difficulty / notes / dates on an existing record.
  const updateRecord = async (bookId, updates) => {
    if (!userId.value) return

    const current = savedBooks.value.find((b) => b.id === bookId)
    if (!current) return
    const merged = { ...current.record, ...updates }

    const { error } = await supabase
      .from('reading_records')
      .update({ ...recordToSnake(merged), updated_at: new Date().toISOString() })
      .eq('book_id', bookId)
      .eq('user_id', userId.value)
    if (error) {
      toast.error('Failed to update book. Please try again.')
      return
    }
    savedBooks.value = savedBooks.value.map((b) =>
      b.id === bookId ? { ...b, record: merged } : b
    )
    persist()
  }

  // FR11 — remove a book; the FK cascade drops its reading record.
  const removeBook = async (bookId) => {
    if (!userId.value) return

    const { error } = await supabase.from('books').delete().eq('id', bookId).eq('user_id', userId.value)
    if (error) {
      toast.error('Failed to remove book. Please try again.')
      return
    }
    savedBooks.value = savedBooks.value.filter((b) => b.id !== bookId)
    persist()
  }

  const retryLoad = () => {
    if (userId.value) loadBooks()
  }

  return {
    savedBooks,
    loaded,
    loadError,
    findByExternalId,
    saveBook,
    updateRecord,
    removeBook,
    retryLoad,
  }
}
