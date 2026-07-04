// recordToSnake maps a camelCase reading record to the reading_records row
// shape. The one non-obvious rule it must honour: added_to_queue_at is a
// NOT NULL column with a DB default of now(), so an explicit null would blow
// up an insert. These tests pin that behaviour.

import { describe, it, expect, vi } from 'vitest'

// useBooks pulls in the Supabase client at import time; stub it so importing
// the pure helper doesn't require env / a live connection.
vi.mock('../lib/supabase.js', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: {} } }) }, from: () => ({}) },
}))

import { recordToSnake } from './useBooks.js'

const base = { targetLanguage: 'fr', status: 'want_to_read' }

describe('recordToSnake', () => {
  it('omits added_to_queue_at entirely when the record has no value (never writes null)', () => {
    const out = recordToSnake({ ...base })
    expect('added_to_queue_at' in out).toBe(false)
    expect(out.added_to_queue_at).toBeUndefined()
  })

  it('omits added_to_queue_at when it is explicitly null/undefined', () => {
    expect('added_to_queue_at' in recordToSnake({ ...base, addedToQueueAt: null })).toBe(false)
    expect('added_to_queue_at' in recordToSnake({ ...base, addedToQueueAt: undefined })).toBe(false)
  })

  it('includes added_to_queue_at when a value is present', () => {
    const ts = '2026-07-04T10:00:00.000Z'
    expect(recordToSnake({ ...base, addedToQueueAt: ts }).added_to_queue_at).toBe(ts)
  })

  it('still maps sort_index (nullable) as a plain value including null', () => {
    expect(recordToSnake({ ...base }).sort_index).toBeNull()
    expect(recordToSnake({ ...base, sortIndex: 20 }).sort_index).toBe(20)
  })
})
