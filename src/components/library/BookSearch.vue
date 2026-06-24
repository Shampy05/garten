<template>
  <div class="space-y-4">
    <div class="gp-card gp-pad">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="sm:w-44 flex-shrink-0">
          <label class="block text-xs font-medium text-stone-500 mb-1">Language</label>
          <select :value="languageCode || ''" @change="onLanguageChange" class="gp-input">
            <option value="">All languages</option>
            <option v-for="lang in languageOptions" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-stone-500 mb-1">Title or author</label>
          <div class="relative">
            <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              v-model="query"
              type="text"
              placeholder="e.g. Le Petit Prince"
              class="gp-input pl-9"
              @input="search"
              @keydown.enter="searchNow"
            />
          </div>
        </div>
      </div>
      <p v-if="languageCode" class="text-xs text-stone-400 mt-2">
        Showing only books in {{ nameForCode(languageCode) }}.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-10 text-stone-400">
      <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50 animate-breathe" />
      <p class="text-sm">Searching the shelves…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="gp-card gp-pad text-center text-stone-500">
      <p class="text-sm mb-3">We couldn't reach the book service. Please try again.</p>
      <button @click="searchNow" class="gp-btn-primary px-5 py-2 text-sm">Retry</button>
    </div>

    <!-- Results -->
    <div v-else-if="results.length">
      <p v-if="source === 'openlibrary'" class="text-xs text-stone-400 mb-3 inline-flex items-center gap-1">
        <Info :size="12" /> Google Books is busy — showing results from Open Library.
      </p>
      <div class="grid sm:grid-cols-2 gap-3">
        <BookResultCard
          v-for="book in results"
          :key="book.externalId"
          :book="book"
          :saved="savedIds.includes(book.externalId)"
          @save="$emit('save', $event)"
        />
      </div>
    </div>

    <!-- Empty after a search -->
    <div v-else-if="hasSearched" class="text-center py-10 text-stone-400">
      <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50" />
      <p class="text-sm">No books found{{ languageCode ? ` in ${nameForCode(languageCode)}` : '' }}. Try another title or language.</p>
    </div>

    <!-- Initial prompt -->
    <div v-else class="text-center py-10 text-stone-400">
      <BookOpen class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p class="text-sm">Search for a book to start your reading list.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Search, BookOpen, Info } from 'lucide-vue-next'
import { useBookSearch } from '../../composables/useBookSearch.js'
import { BOOK_LANGUAGES, nameForCode, codeForName } from '../../lib/bookLanguages.js'
import BookResultCard from './BookResultCard.vue'

const props = defineProps({
  savedIds: { type: Array, default: () => [] },
  defaultLanguageCode: { type: String, default: null },
  // The user's tracked Garten languages. The dropdown only shows languages the
  // user has already added to their garden (with an "All languages" fallback
  // when they have none in the curated reading set yet).
  languages: { type: Array, default: () => [] },
})

defineEmits(['save'])

const { query, languageCode, results, source, loading, error, hasSearched, search, searchNow, setLanguage, cleanup } = useBookSearch()

const languageOptions = computed(() => {
  const codes = new Set((props.languages || [])
    .map((l) => codeForName(l.name))
    .filter(Boolean))
  const filtered = BOOK_LANGUAGES.filter((l) => codes.has(l.code))
  return filtered.length ? filtered : BOOK_LANGUAGES
})

onMounted(() => {
  if (props.defaultLanguageCode) setLanguage(props.defaultLanguageCode)
})

onBeforeUnmount(cleanup)

// If the currently selected language is removed from the user's garden,
// reset the filter so the dropdown never shows a stale selection.
watch(languageOptions, (opts) => {
  if (languageCode.value && !opts.find((o) => o.code === languageCode.value)) {
    setLanguage(null)
  }
})

function onLanguageChange(e) {
  setLanguage(e.target.value || null)
}
</script>
