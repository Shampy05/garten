// "Just finished" detection — a pure helper for the moment a saved book
// transitions from `reading` to `read` between two snapshots. Used by the
// Library view to fire a quiet toast (matching the milestone toast register)
// the first time a user finishes a book.
//
// Returns the book that just finished (compact shape, suitable for the toast
// title), or null. The caller compares two consecutive savedBooks arrays; we
// only need prev+current, not a full diff.

export function bookJustFinished(prevBooks = [], currBooks = []) {
  const prevById = new Map()
  for (const b of prevBooks) {
    if (b?.id) prevById.set(b.id, b.record?.status || null)
  }
  for (const b of currBooks) {
    if (!b?.id) continue
    if (b.record?.status === 'read' && prevById.get(b.id) === 'reading') {
      return { id: b.id, title: b.title, author: b.author, languageCode: b.languageCode }
    }
  }
  return null
}
