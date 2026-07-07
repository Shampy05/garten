<template>
  <!-- Discover rows: each states why it exists. Rows with nothing to show
       (still loading, empty after filtering) collapse silently — discovery
       is additive, never a broken-looking placeholder. -->
  <div v-if="displayRows.length" class="space-y-6">
    <div v-for="row in displayRows" :key="row.seed.key" class="animate-fade-up">
      <div class="flex items-baseline justify-between mb-0.5">
        <h4 class="gp-title text-sm uppercase tracking-wider text-stone-500 inline-flex items-center gap-1.5">
          <Sparkles :size="12" />
          {{ row.seed.title }}
        </h4>
        <span class="text-[11px] text-stone-400">{{ row.books.length }} {{ row.books.length === 1 ? 'suggestion' : 'suggestions' }}</span>
      </div>
      <p class="text-[11px] text-stone-400 mb-2.5">{{ row.seed.reason }}</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <BookResultCard
          v-for="book in row.books"
          :key="book.externalId"
          :book="book"
          :saved="savedIdSet.has(book.externalId)"
          @save="$emit('save', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { useDiscover } from '../../composables/useDiscover.js'
import { filterRowBooks } from '../../lib/discover.js'
import BookResultCard from './BookResultCard.vue'

const props = defineProps({
  savedBooks: { type: Array, default: () => [] },
  savedIds: { type: Array, default: () => [] },
  entries: { type: Array, default: () => [] },
  languages: { type: Array, default: () => [] },
  // True once books + study data have actually loaded. Seeds built from a
  // still-empty library would prune every cached row on each page load and
  // refetch it seconds later — so we wait.
  ready: { type: Boolean, default: false },
})

defineEmits(['save'])

const discover = useDiscover()

const savedIdSet = computed(() => new Set(props.savedIds))

// Render-time shaping: drop saved books and cross-row duplicates, apply each
// seed's page cap/sort, cut to row size. Recomputes when a book is saved, so
// suggestions vanish the moment they enter the library.
const displayRows = computed(() => {
  const placed = new Set()
  const out = []
  for (const row of discover.rows.value) {
    if (!row.books || !row.books.length) continue
    const books = filterRowBooks(row.books, {
      savedExternalIds: savedIdSet.value,
      excludeExternalIds: placed,
      maxPages: row.seed.postFilter?.maxPages || null,
      sort: row.seed.postFilter?.sort || null,
    })
    if (!books.length) continue
    for (const b of books) placed.add(b.externalId)
    out.push({ seed: row.seed, books })
  }
  return out
})

function reload() {
  if (!props.ready) return
  discover.load({
    savedBooks: props.savedBooks,
    entries: props.entries,
    languages: props.languages,
  })
}

onBeforeUnmount(discover.cleanup)

// Load once data is ready, and again when the seed lineup can have changed:
// the library gains/loses a book OR a book flips to finished (which doesn't
// change the length) — fingerprint both. Deliberately not a deep watch:
// page-progress logs shouldn't refetch rows.
watch(
  () => `${props.ready}:${props.savedBooks.length}:${props.savedBooks.filter((b) => b.record?.status === 'read').length}`,
  reload,
  { immediate: true }
)
</script>
