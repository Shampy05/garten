// FR12 — a summary of reading activity per language. Pure aggregation so it can
// be unit-tested and reused (the ReadingSummary component renders the result).

import { nameForCode } from './bookLanguages.js'

export const READING_STATUSES = ['want_to_read', 'reading', 'read']

export const STATUS_LABELS = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  read: 'Read',
}

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']

// Given the joined saved-books list (each item carries `languageCode` and a
// nested `record.status`), return one row per language with counts by status,
// sorted by total descending then name. Books with an unknown/missing status
// are ignored in the per-status tallies but still counted in `total`.
export function summaryByLanguage(savedBooks = []) {
  const byCode = new Map()

  for (const book of savedBooks) {
    const code = book?.languageCode || 'unknown'
    let row = byCode.get(code)
    if (!row) {
      row = {
        languageCode: code,
        languageName: nameForCode(code),
        want_to_read: 0,
        reading: 0,
        read: 0,
        total: 0,
      }
      byCode.set(code, row)
    }
    row.total += 1
    const status = book?.record?.status
    if (status && status in STATUS_LABELS) row[status] += 1
  }

  return [...byCode.values()].sort(
    (a, b) => b.total - a.total || a.languageName.localeCompare(b.languageName)
  )
}
