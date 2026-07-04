import { describe, it, expect } from 'vitest'
import { bookJustFinished } from './finishCelebration.js'

const book = (id, status, title = `Book ${id}`) => ({
  id,
  title,
  author: 'A',
  coverUrl: null,
  languageCode: 'fr',
  record: { status, currentPage: 0, totalPages: 100 },
})

describe('bookJustFinished', () => {
  it('returns null when there is no previous state', () => {
    expect(bookJustFinished([], [book('1', 'read')])).toBeNull()
  })

  it('returns null when nothing transitions from reading to read', () => {
    const prev = [book('1', 'reading'), book('2', 'want_to_read')]
    const curr = [book('1', 'reading'), book('2', 'want_to_read')]
    expect(bookJustFinished(prev, curr)).toBeNull()
  })

  it('returns the book that just transitioned from reading to read', () => {
    const prev = [book('1', 'reading', 'Le Petit Prince')]
    const curr = [book('1', 'read', 'Le Petit Prince')]
    expect(bookJustFinished(prev, curr)).toEqual({
      id: '1',
      title: 'Le Petit Prince',
      author: 'A',
      languageCode: 'fr',
    })
  })

  it('ignores books that are already read in the previous state', () => {
    const prev = [book('1', 'read')]
    const curr = [book('1', 'read')]
    expect(bookJustFinished(prev, curr)).toBeNull()
  })

  it('only flags the first reading→read flip in the snapshot', () => {
    const prev = [book('1', 'reading'), book('2', 'reading')]
    const curr = [book('1', 'read'), book('2', 'read')]
    // Both finished in the same snapshot — return the first.
    const result = bookJustFinished(prev, curr)
    expect(result?.id).toBe('1')
  })

  it('handles a finished book appearing for the first time as not a flip', () => {
    // Book is added directly in `read` state, no `reading` to flip from.
    const prev = []
    const curr = [book('1', 'read')]
    expect(bookJustFinished(prev, curr)).toBeNull()
  })

  it('tolerates a book without a record', () => {
    const prev = [{ id: '1', record: null }]
    const curr = [{ id: '1', record: { status: 'read' } }]
    expect(bookJustFinished(prev, curr)).toBeNull()
  })
})
