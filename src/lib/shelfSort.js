// Pure sort + reorder math for the Reading shelves. Lives in lib/ so unit
// tests can import it without pulling in the Supabase realtime client (which
// requires a native WebSocket and breaks the test runner). The composable
// useShelves.js re-exports these and adds the persistence layer on top.

// Active shelf: status = 'reading'. Most recently started wins; ties broken
// by currentPage (further-along book wins).
export function sortActive(books) {
  return books.slice().sort((a, b) => {
    const byStart = String(b.record?.startedAt || '').localeCompare(String(a.record?.startedAt || ''))
    if (byStart !== 0) return byStart
    return (b.record?.currentPage || 0) - (a.record?.currentPage || 0)
  })
}

// Queue shelf: status = 'want_to_read'. Manual sort_index wins when set;
// otherwise addedToQueueAt desc (oldest queued book sits at the top).
export function sortQueue(books) {
  return books.slice().sort((a, b) => {
    const ai = a.record?.sortIndex
    const bi = b.record?.sortIndex
    if (ai != null && bi != null) return ai - bi
    if (ai != null) return -1
    if (bi != null) return 1
    return String(b.record?.addedToQueueAt || '').localeCompare(String(a.record?.addedToQueueAt || ''))
  })
}

// Finished shelf: status = 'read'. Most recently finished first.
export function sortFinished(books) {
  return books.slice().sort((a, b) =>
    String(b.record?.finishedAt || '').localeCompare(String(a.record?.finishedAt || ''))
  )
}

// Compute the next two sort_index values for swapping a with b inside `books`.
// Sparse-integer scheme so a single reorder only writes two rows, not the
// whole queue. Returns a { [id]: sortIndex } map of rows that need to be
// updated, or null if either id is missing.
export function nextSwapIndices(books, aId, bId, direction) {
  const a = books.find((x) => x.id === aId)
  const b = books.find((x) => x.id === bId)
  if (!a || !b) return null
  const aSort = a.record?.sortIndex
  const bSort = b.record?.sortIndex

  if (aSort == null && bSort == null) {
    const idx = books.findIndex((x) => x.id === aId)
    return { [aId]: idx * 10, [bId]: (idx + 1) * 10 }
  }
  if (aSort == null) {
    return { [aId]: direction === 'up' ? bSort - 1 : bSort + 1 }
  }
  if (bSort == null) {
    return { [bId]: direction === 'up' ? aSort - 1 : aSort + 1 }
  }
  return { [aId]: bSort, [bId]: aSort }
}
