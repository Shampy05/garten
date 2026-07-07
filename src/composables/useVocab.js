import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { getCached, setCache } from '../lib/cache.js'
import { localDateStr } from '../lib/date.js'
import { reviewWord, countDue } from '../lib/srs.js'
import { useToast } from './useToast.js'
import { useAuth } from './useAuth.js'

// Word Garden state — the user's planted words with their SRS fields. Shared
// module-level state, mirroring useBooks: WordGardenView, the review session,
// and App.vue's due-count nav dot all read the same source of truth.
//
// Cache namespace: cache.js keys everything as `garten_data_<x>`; useStorage
// owns `garten_data_<uid>` and useBooks `garten_data_books_<uid>`, so this
// composable passes `vocab_<uid>` to land on `garten_data_vocab_<uid>` and
// collide with neither.

const words = ref([])
const loaded = ref(false)
const loadError = ref(false)
let initialized = false

function cacheKey(userId) {
  return `vocab_${userId}`
}

function wordToSnake(word) {
  return {
    id: word.id,
    language_id: word.languageId,
    term: word.term,
    meaning: word.meaning,
    note: word.note || null,
    source_book_id: word.sourceBookId ?? null,
    stage: word.stage ?? 0,
    due_date: word.dueDate,
    lapses: word.lapses ?? 0,
    review_count: word.reviewCount ?? 0,
    last_reviewed_at: word.lastReviewedAt ?? null,
  }
}

function rowToCamel(row) {
  return {
    id: row.id,
    languageId: row.language_id,
    term: row.term,
    meaning: row.meaning,
    note: row.note ?? null,
    sourceBookId: row.source_book_id ?? null,
    stage: row.stage ?? 0,
    dueDate: row.due_date,
    lapses: row.lapses ?? 0,
    reviewCount: row.review_count ?? 0,
    lastReviewedAt: row.last_reviewed_at ?? null,
    createdAt: row.created_at ?? null,
  }
}

// Words due for review right now. Computed once at module level so the nav
// dot and the view share it. Known limit: `localDateStr(new Date())` is read
// when the computed re-evaluates, so a tab left open across midnight won't
// bump the count until the next mutation — acceptable for v1.
const dueCount = computed(() => countDue(words.value, localDateStr(new Date())))

export function useVocab() {
  const { userId } = useAuth()
  const toast = useToast()

  const persist = () => setCache(cacheKey(userId.value), words.value)

  const loadWords = async () => {
    if (!userId.value) {
      words.value = []
      loaded.value = false
      loadError.value = false
      return
    }

    const cached = getCached(cacheKey(userId.value))
    if (cached) {
      words.value = cached
      loaded.value = true
      loadError.value = false
      return
    }

    loadError.value = false
    try {
      const { data, error } = await supabase
        .from('vocab_words')
        .select('*')
        .eq('user_id', userId.value)
        .order('created_at', { ascending: false })
      if (error) throw error
      words.value = (data || []).map(rowToCamel)
      persist()
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
          loadWords()
        } else {
          words.value = []
          loaded.value = false
        }
      },
      { immediate: true }
    )
  }

  // Plant a new word. Case-insensitive duplicate check within the language —
  // a duplicate returns { duplicate: true, existing } so the form can show a
  // gentle note instead of inserting a second copy.
  //
  // `meaning` is optional — mining from a passage (`MineWordsModal`) plants
  // batches with empty meanings the gardener fills in later, so we accept
  // null/empty as a "to-define" placeholder. Hand capture (`WordCaptureForm`)
  // still validates presence at the form level so manual plants keep their
  // meaning before pressing "Plant".
  const addWord = async ({ term, meaning, languageId, note = null, sourceBookId = null }) => {
    if (!userId.value) return { error: 'Not signed in' }
    const cleanTerm = (term || '').trim()
    const cleanMeaning = (meaning || '').trim()
    if (!cleanTerm || !languageId) return { error: 'Missing fields' }

    const existing = words.value.find(
      (w) => w.languageId === languageId && w.term.trim().toLowerCase() === cleanTerm.toLowerCase()
    )
    if (existing) return { duplicate: true, existing }

    const word = {
      id: crypto.randomUUID(),
      languageId,
      term: cleanTerm,
      meaning: cleanMeaning || null,
      note: (note || '').trim() || null,
      sourceBookId,
      stage: 0,
      dueDate: localDateStr(new Date()),
      lapses: 0,
      reviewCount: 0,
      lastReviewedAt: null,
      createdAt: new Date().toISOString(),
    }

    words.value = [word, ...words.value]
    persist()

    const { error } = await supabase
      .from('vocab_words')
      .insert({ ...wordToSnake(word), user_id: userId.value })
    if (error) {
      words.value = words.value.filter((w) => w.id !== word.id)
      persist()
      // Surface the real error so callers (and the toast) can see constraint
      // violations, e.g. "null value in column 'meaning' violates not-null
      // constraint" — a tell that the latest migration hasn't been applied
      // to the live database.
      const detail = error.message || 'Unknown error'
      toast.error(`Couldn't plant “${cleanTerm}” — ${detail}`)
      return { error: detail }
    }
    return { word }
  }

  const updateWord = async (id, updates) => {
    if (!userId.value) return
    const idx = words.value.findIndex((w) => w.id === id)
    if (idx === -1) return
    const prev = words.value[idx]
    const next = { ...prev, ...updates }
    words.value = words.value.map((w) => (w.id === id ? next : w))
    persist()

    const { error } = await supabase
      .from('vocab_words')
      .update({ ...wordToSnake(next), updated_at: new Date().toISOString() })
      .eq('user_id', userId.value)
      .eq('id', id)
    if (error) {
      words.value = words.value.map((w) => (w.id === id ? prev : w))
      persist()
      toast.error("Couldn't save that change — please try again.")
    }
  }

  const removeWord = async (id) => {
    if (!userId.value) return
    const prev = words.value
    words.value = words.value.filter((w) => w.id !== id)
    persist()

    const { error } = await supabase
      .from('vocab_words')
      .delete()
      .eq('user_id', userId.value)
      .eq('id', id)
    if (error) {
      words.value = prev
      persist()
      toast.error("Couldn't remove that word — please try again.")
    }
  }

  // Bulk delete for the multi-select flow. Optimistic — drops the rows
  // locally first, then fires one DELETE with `id IN (...)`. If the
  // server returns a partial result or an error, we roll back the whole
  // set: the user can always re-select and try again, but a partial
  // delete with no UI signal would be worse than a rollback.
  const removeWords = async (ids) => {
    if (!userId.value) return { error: 'Not signed in' }
    if (!Array.isArray(ids) || !ids.length) return { count: 0 }
    const prev = words.value
    const idSet = new Set(ids)
    words.value = words.value.filter((w) => !idSet.has(w.id))
    persist()
    const { error } = await supabase
      .from('vocab_words')
      .delete()
      .eq('user_id', userId.value)
      .in('id', ids)
    if (error) {
      words.value = prev
      persist()
      toast.error(`Couldn't remove those words — ${error.message || 'unknown error'}.`)
      return { error: error.message }
    }
    return { count: ids.length }
  }

  // Apply one review grade (again/good/easy) — the SRS math lives in
  // src/lib/srs.js; this just merges and persists the result.
  const gradeWord = async (id, grade) => {
    const word = words.value.find((w) => w.id === id)
    if (!word) return
    await updateWord(id, reviewWord(word, grade))
  }

  return {
    words,
    loaded,
    loadError,
    dueCount,
    retryLoad: loadWords,
    addWord,
    updateWord,
    removeWord,
    removeWords,
    gradeWord,
  }
}
