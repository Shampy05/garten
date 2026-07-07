// Regression: addWord() already blocked a case-insensitive duplicate term
// within a language, but updateWord() (the rename path used by WordCard's
// inline edit) didn't check at all — renaming a word to collide with an
// existing one silently created two rows with the same term.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

let insertCalls = []
let updateCalls = []

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      insert: (payload) => {
        insertCalls.push(payload)
        return Promise.resolve({ error: null })
      },
      update: (payload) => ({
        eq: () => ({
          eq: () => {
            updateCalls.push(payload)
            return Promise.resolve({ error: null })
          },
        }),
      }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }),
  },
}))

const userIdRef = ref(null)
vi.mock('./useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }))
vi.mock('./useAuth.js', () => ({ useAuth: () => ({ userId: userIdRef }) }))

import { useVocab } from './useVocab.js'

describe('useVocab duplicate guards', () => {
  beforeEach(async () => {
    insertCalls = []
    updateCalls = []
    userIdRef.value = 'u1'
    const { words } = useVocab()
    words.value = []
  })

  it('addWord blocks a case-insensitive duplicate within the same language', async () => {
    const { addWord } = useVocab()
    const first = await addWord({ term: 'Haus', meaning: 'house', languageId: 'german' })
    expect(first.word).toBeDefined()
    const second = await addWord({ term: 'haus', meaning: 'house (again)', languageId: 'german' })
    expect(second.duplicate).toBe(true)
    expect(second.existing.id).toBe(first.word.id)
    expect(insertCalls).toHaveLength(1)
  })

  it('updateWord rejects a rename that collides with another word in the same language', async () => {
    const { addWord, updateWord } = useVocab()
    const a = await addWord({ term: 'Haus', meaning: 'house', languageId: 'german' })
    const b = await addWord({ term: 'Baum', meaning: 'tree', languageId: 'german' })

    const result = await updateWord(b.word.id, { term: 'haus' })
    expect(result?.duplicate).toBe(true)
    expect(result.existing.id).toBe(a.word.id)

    // The rename never happened — "Baum" is untouched, and no UPDATE fired.
    const { words } = useVocab()
    expect(words.value.find((w) => w.id === b.word.id).term).toBe('Baum')
    expect(updateCalls).toHaveLength(0)
  })

  it('updateWord allows a rename to a name that is only a duplicate in a different language', async () => {
    const { addWord, updateWord } = useVocab()
    const a = await addWord({ term: 'Haus', meaning: 'house', languageId: 'german' })
    const b = await addWord({ term: 'Casa', meaning: 'house', languageId: 'spanish' })

    const result = await updateWord(b.word.id, { term: 'Haus' })
    expect(result?.duplicate).toBeUndefined()

    const { words } = useVocab()
    expect(words.value.find((w) => w.id === b.word.id).term).toBe('Haus')
    expect(updateCalls).toHaveLength(1)
    void a
  })

  it('updateWord does not run the duplicate check for unrelated field updates (e.g. grading)', async () => {
    const { addWord, updateWord } = useVocab()
    const a = await addWord({ term: 'Haus', meaning: 'house', languageId: 'german' })
    const result = await updateWord(a.word.id, { stage: 1, dueDate: '2026-07-08' })
    expect(result).toBeUndefined()
    expect(updateCalls).toHaveLength(1)
  })
})
