import { describe, it, expect } from 'vitest'
import { summaryByLanguage } from './readingStats.js'

const book = (languageCode, status) => ({ languageCode, record: { status } })

describe('summaryByLanguage', () => {
  it('returns an empty array for no books', () => {
    expect(summaryByLanguage([])).toEqual([])
    expect(summaryByLanguage()).toEqual([])
  })

  it('counts statuses per language', () => {
    const books = [
      book('fr', 'read'),
      book('fr', 'read'),
      book('fr', 'reading'),
      book('es', 'want_to_read'),
    ]
    const summary = summaryByLanguage(books)
    const fr = summary.find((r) => r.languageCode === 'fr')
    expect(fr).toMatchObject({
      languageName: 'French',
      read: 2,
      reading: 1,
      want_to_read: 0,
      total: 3,
    })
    const es = summary.find((r) => r.languageCode === 'es')
    expect(es).toMatchObject({ want_to_read: 1, total: 1 })
  })

  it('sorts by total descending', () => {
    const books = [book('es', 'read'), book('fr', 'read'), book('fr', 'reading')]
    expect(summaryByLanguage(books).map((r) => r.languageCode)).toEqual(['fr', 'es'])
  })

  it('counts books with an unknown status in the total but not per-status', () => {
    const summary = summaryByLanguage([book('de', 'bogus')])
    expect(summary[0]).toMatchObject({ total: 1, read: 0, reading: 0, want_to_read: 0 })
  })
})
