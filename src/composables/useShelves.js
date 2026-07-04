// Reading shelves — the active / queue / finished split, with reorder and a
// soft cap on how many books can be actively read at once. Pure derivation
// over useBooks().savedBooks + a small set of mutation helpers (move, mark,
// reorder) that keep the persisted reading_records row in sync.
//
// Cap behaviour: when the user moves a queue book to Reading while already at
// the cap, moveToReading() returns { needsConfirmation: true } instead of
// mutating, so the caller can show a soft prompt. Re-calling with { force:
// true } bypasses the prompt.

import { computed } from 'vue'
import { useAuth } from './useAuth.js'
import { useBooks } from './useBooks.js'
import { useToast } from './useToast.js'
import { supabase } from '../lib/supabase.js'
import { sortActive, sortQueue, sortFinished, nextSwapIndices, initSortIndices } from '../lib/shelfSort.js'

export { sortActive, sortQueue, sortFinished, nextSwapIndices, initSortIndices }

export const ACTIVE_CAP = 3

// Serialise reorders across every click and every useShelves() consumer. A
// reorder is async: the null-queue path runs N init writes followed by a
// 2-row swap, a long window in which a second click (users tap ▲/▼ repeatedly
// to move a book several slots) would read a half-updated queue and interleave
// with the first — losing a move or flinging books the wrong way. Chaining
// each reorder after the previous one means every click runs against fresh,
// fully-settled queue state. Module-level so it holds even though useShelves()
// builds a new closure per caller.
let reorderTail = Promise.resolve()

// ── Composable ─────────────────────────────────────────────────────────────

export function useShelves() {
  const { userId } = useAuth()
  const { savedBooks, persist, updateRecord } = useBooks()
  const toast = useToast()

  const active = computed(() =>
    sortActive(savedBooks.value.filter((b) => b.record?.status === 'reading'))
  )

  const queue = computed(() =>
    sortQueue(savedBooks.value.filter((b) => b.record?.status === 'want_to_read'))
  )

  const finished = computed(() =>
    sortFinished(savedBooks.value.filter((b) => b.record?.status === 'read'))
  )

  const activeCount = computed(() => active.value.length)
  const atActiveCap = computed(() => active.value.length >= ACTIVE_CAP)

  // Move a queue book (or a finished one) to Reading. If the active cap is
  // already hit, the caller gets { needsConfirmation: true } and decides.
  // Pass { force: true } to bypass the cap (used after a soft-prompt confirm).
  async function moveToReading(bookId, { force = false } = {}) {
    if (atActiveCap.value && !force) {
      return { needsConfirmation: true, count: activeCount.value }
    }
    const current = savedBooks.value.find((b) => b.id === bookId)
    if (!current) return { error: 'Book not found' }
    const today = new Date().toISOString().slice(0, 10)
    const updates = { status: 'reading' }
    if (!current.record?.startedAt) updates.startedAt = today
    return { ...(await updateRecord(bookId, updates)), needsConfirmation: false }
  }

  // Send a reading book back to the queue. Resets sortIndex so it lands at
  // the bottom of Up next (or wherever the user reorders it).
  async function moveToQueue(bookId) {
    const updates = { status: 'want_to_read', startedAt: null }
    return updateRecord(bookId, updates)
  }

  // Start a re-read of a finished book. Sets status:reading, stamps a fresh
  // startedAt, clears finishedAt, and resets currentPage to 0 so the progress
  // bar reflects the re-read from the start. totalPages stays — that's the
  // book, not the read-through — and so the progress bar reads sensibly as
  // the user logs new pages.
  //
  // Cap-aware: the soft cap of 3 simultaneous Reading books still applies.
  // Caller gets { needsConfirmation: true } at the cap; pass { force: true }
  // to bypass (used after a soft-prompt confirm, same shape as moveToReading).
  async function startReread(bookId, { force = false } = {}) {
    if (atActiveCap.value && !force) {
      return { needsConfirmation: true, count: activeCount.value }
    }
    const current = savedBooks.value.find((b) => b.id === bookId)
    if (!current) return { error: 'Book not found' }
    const today = new Date().toISOString().slice(0, 10)
    return {
      ...(await updateRecord(bookId, {
        status: 'reading',
        startedAt: today,
        finishedAt: null,
        currentPage: 0,
      })),
      needsConfirmation: false,
    }
  }

  // Mark a book as read. If there's an unfinished book with a known total
  // page count, also nudge currentPage to the end so the progress bar reads
  // 100%. Sets finishedAt to today if not already set.
  async function markAsRead(bookId) {
    const current = savedBooks.value.find((b) => b.id === bookId)
    if (!current) return { error: 'Book not found' }
    const today = new Date().toISOString().slice(0, 10)
    const updates = {
      status: 'read',
      finishedAt: current.record?.finishedAt || today,
    }
    if (current.record?.totalPages && (current.record?.currentPage || 0) < current.record.totalPages) {
      updates.currentPage = current.record.totalPages
    }
    return updateRecord(bookId, updates)
  }

  // Persist a single sort_index for one book. Updates the in-memory list and
  // the localStorage cache so reloads see the new order before Supabase
  // round-trips back. Failures toast and leave the in-memory state alone.
  async function writeSortIndex(bookId, newSort) {
    if (!userId.value) return
    const { error } = await supabase
      .from('reading_records')
      .update({ sort_index: newSort, updated_at: new Date().toISOString() })
      .eq('user_id', userId.value)
      .eq('book_id', bookId)
    if (error) {
      toast.error('Failed to reorder. Please try again.')
      return
    }
    const book = savedBooks.value.find((b) => b.id === bookId)
    if (book && book.record) {
      book.record = { ...book.record, sortIndex: newSort }
    }
    persist()
  }

  // Move a queue book up (toward the top) or down (toward the bottom) by one
  // position. After any save, the queue starts in a mixed state — some books
  // have a manual sortIndex, others fall back to addedToQueueAt — and a swap
  // on that mixed state would mint sortIndex for only the swapped pair,
  // pushing them to the top (sortQueue puts all sorted rows before all null
  // rows). The fix is to normalise the whole queue on first reorder: assign
  // each book a sortIndex that mirrors its current visual position. Cost: N
  // writes on the first reorder after a save. Subsequent reorders are the
  // usual sparse 2-row swap.
  // Public entry: chain onto the shared tail so overlapping clicks run one at
  // a time (see reorderTail above). Returns the tail so callers can await the
  // moment their click has been applied.
  // `visibleIds` is the ordered id list the user is actually looking at — the
  // language-filtered subset rendered by SavedBooksList. Neighbours are found
  // within that subset so "up" swaps with the book above *in view*, not with a
  // hidden other-language row (which would look like a no-op). Omit it and the
  // whole queue is treated as visible.
  function reorderQueue(bookId, direction, visibleIds = null) {
    // Log rather than silently swallow: a swallowed rejection here once hid a
    // real crash (persist was undefined) and made reorders look like no-ops.
    reorderTail = reorderTail
      .then(() => runReorder(bookId, direction, visibleIds))
      .catch((e) => console.error('reorderQueue failed', e))
    return reorderTail
  }

  async function runReorder(bookId, direction, visibleIds) {
    const items = queue.value
    const visible = visibleIds
      ? visibleIds.filter((id) => items.some((b) => b.id === id))
      : items.map((b) => b.id)
    const vIdx = visible.indexOf(bookId)
    if (vIdx < 0) return
    const vNext = direction === 'up' ? vIdx - 1 : vIdx + 1
    if (vNext < 0 || vNext >= visible.length) return

    if (items.some((b) => b.record?.sortIndex == null)) {
      const init = initSortIndices(items)
      for (const [id, sort] of Object.entries(init)) {
        await writeSortIndex(id, sort)
      }
    }

    // init preserves visual order, so the captured `visible` order still holds
    // after it. Swap the target with its visible neighbour by their (now
    // non-null) indices; a blind index swap leapfrogs any hidden rows between
    // them without disturbing those hidden rows' positions.
    const refreshed = queue.value
    const updates = nextSwapIndices(refreshed, bookId, visible[vNext])
    if (!updates) return
    for (const [id, sort] of Object.entries(updates)) {
      await writeSortIndex(id, sort)
    }
  }

  return {
    active,
    queue,
    finished,
    activeCount,
    atActiveCap,
    activeCap: ACTIVE_CAP,
    moveToReading,
    moveToQueue,
    startReread,
    markAsRead,
    reorderQueue,
  }
}
