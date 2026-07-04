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

// Initialise sortIndex across the whole queue. Called on the first reorder
// after a save so that the queue has a fully ordered index space before any
// swap runs. After init, every subsequent reorder is just a 2-row swap and
// stays sparse. The values use 10-spaced integers so a mid-queue swap can
// always pick a new neighbour that fits without renumbering.
//
// Without this step, a swap that mints sortIndex for only the pair would
// push them to the top of the queue (sortQueue puts all sorted rows before
// all null rows), which is the "books jump in the wrong direction" bug.
export function initSortIndices(books) {
  const out = {}
  for (let i = 0; i < books.length; i++) {
    out[books[i].id] = (i + 1) * 10
  }
  return out
}

// Swap two rows in a fully-sorted queue. Pure blind swap: a takes b's index,
// b takes a's. The sparse-integer scheme means a single move only writes two
// rows. Returns null if either id is missing OR if either row has a null
// sortIndex (the caller is expected to initialise the queue first).
export function nextSwapIndices(books, aId, bId) {
  const a = books.find((x) => x.id === aId)
  const b = books.find((x) => x.id === bId)
  if (!a || !b) return null
  const aSort = a.record?.sortIndex
  const bSort = b.record?.sortIndex
  if (aSort == null || bSort == null) return null
  return { [aId]: bSort, [bId]: aSort }
}
