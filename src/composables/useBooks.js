import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { getCached, setCache } from '../lib/cache.js'
import { useToast } from './useToast.js'
import { useAuth } from './useAuth.js'
import { nameForCode } from '../lib/bookLanguages.js'

// Saved books + their 1:1 reading records. Shared module-level state so every
// consumer of useBooks() reads the same source of truth. This matters because
// both LibraryView and LogPagesModal call useBooks(); without shared state, a
// page log would update one instance's in-memory list while the displayed cards
// read a stale instance.
//
// The pattern mirrors useAuth(): per-user Supabase reads scoped by user_id,
// a 30s localStorage cache, optimistic in-memory updates, and toast on failure.
//
// Cache namespace: cache.js keys everything as `garten_data_<x>`. useStorage
// owns `garten_data_<uid>`, so this composable passes `books_<uid>` to land on
// a separate `garten_data_books_<uid>` entry and avoid clobbering it.

const savedBooks = ref([])
const loaded = ref(false)
const loadError = ref(false)
let initialized = false

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
    current_page: record.currentPage ?? null,
    total_pages: record.totalPages ?? null,
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
          currentPage: recordRow.current_page ?? null,
          totalPages: recordRow.total_pages ?? null,
        }
      : null,
  }
}

export function useBooks() {
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

  if (!initialized) {
    initialized = true
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
  }

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
      currentPage: record.currentPage ?? existing?.record?.currentPage ?? null,
      totalPages: record.totalPages ?? existing?.record?.totalPages ?? volume.pageCount ?? null,
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

  // ---------------------------------------------------------------------------
  // Reading progress
  // ---------------------------------------------------------------------------

  const loadProgress = async (bookId) => {
    if (!userId.value) return []
    const { data, error } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', userId.value)
      .eq('book_id', bookId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load reading history.')
      return []
    }
    return (data || []).map((r) => ({
      id: r.id,
      bookId: r.book_id,
      date: r.date,
      pagesRead: r.pages_read,
      fromPage: r.from_page,
      toPage: r.to_page,
      minutes: r.minutes,
      notes: r.notes,
      createdAt: r.created_at,
    }))
  }

  const logProgress = async (bookId, { pagesRead, fromPage, toPage, minutes, notes, languageColor }) => {
    if (!userId.value) return { error: 'Not signed in' }

    const book = savedBooks.value.find((b) => b.id === bookId)
    if (!book) return { error: 'Book not found' }

    const totalPages = book.record?.totalPages
    if (!totalPages || totalPages <= 0) {
      return { error: 'Set a total page count before logging progress.' }
    }

    const oldPage = book.record?.currentPage ?? 0
    const newPage = Math.min(totalPages, oldPage + Math.max(1, Math.round(Number(pagesRead) || 0)))
    const actualPagesRead = newPage - oldPage
    if (actualPagesRead <= 0) {
      return { error: 'You are already at or past the last page.' }
    }

    const today = new Date().toISOString().slice(0, 10)
    const { error: progressErr } = await supabase.from('reading_progress').insert({
      user_id: userId.value,
      book_id: bookId,
      date: today,
      pages_read: actualPagesRead,
      from_page: fromPage ?? null,
      to_page: toPage ?? null,
      minutes: minutes ? Math.max(0, Math.round(Number(minutes))) : null,
      notes: notes?.trim() || null,
    })
    if (progressErr) {
      toast.error('Failed to log pages. Please try again.')
      return { error: progressErr.message }
    }

    const isFinished = newPage >= totalPages
    const recordUpdates = {
      currentPage: newPage,
      status: isFinished ? 'read' : book.record?.status === 'want_to_read' ? 'reading' : book.record?.status,
      startedAt: book.record?.startedAt || (isFinished || newPage > 0 ? today : null),
      finishedAt: isFinished ? (book.record?.finishedAt || today) : book.record?.finishedAt,
    }

    const { error: recErr } = await supabase
      .from('reading_records')
      .update({
        ...recordToSnake({ ...book.record, ...recordUpdates }),
        updated_at: new Date().toISOString(),
      })
      .eq('book_id', bookId)
      .eq('user_id', userId.value)
    if (recErr) {
      toast.error('Failed to update book progress.')
      return { error: recErr.message }
    }

    try {
      await supabase.rpc('check_reading_milestone', {
        p_user_id: userId.value,
        p_book_id: bookId,
        p_old_page: oldPage,
        p_new_page: newPage,
        p_total_pages: totalPages,
        p_book_title: book.title,
        p_language_name: book.record?.targetLanguage ? nameForCode(book.record.targetLanguage) : book.title,
        p_language_color: languageColor || null,
      })
    } catch (e) {
      // Milestone celebrations are best-effort; don't block the log flow.
    }

    const mergedRecord = { ...book.record, ...recordUpdates }
    savedBooks.value = savedBooks.value.map((b) =>
      b.id === bookId ? { ...b, record: mergedRecord } : b
    )
    persist()
    toast.success(`${actualPagesRead} page${actualPagesRead === 1 ? '' : 's'} logged.`)
    return { book: { ...book, record: mergedRecord }, pagesRead: actualPagesRead }
  }

  const updateTotalPages = async (bookId, totalPages) => {
    if (!userId.value) return
    const current = savedBooks.value.find((b) => b.id === bookId)
    if (!current) return

    const value = totalPages ? Math.max(1, Math.round(Number(totalPages))) : null
    const { error } = await supabase
      .from('reading_records')
      .update({ total_pages: value, updated_at: new Date().toISOString() })
      .eq('book_id', bookId)
      .eq('user_id', userId.value)
    if (error) {
      toast.error('Failed to update page count.')
      return
    }
    savedBooks.value = savedBooks.value.map((b) =>
      b.id === bookId ? { ...b, record: { ...b.record, totalPages: value } } : b
    )
    persist()
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
    loadProgress,
    logProgress,
    updateTotalPages,
  }
}
