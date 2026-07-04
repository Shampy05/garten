<template>
  <div class="space-y-4">
    <!-- Query row: language + title/author. -->
    <div class="gp-card gp-pad space-y-3">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="sm:w-44 flex-shrink-0">
          <label class="block text-xs font-medium text-stone-500 mb-1">Language</label>
          <select :value="selectedLanguageId" @change="onLanguageChange" class="gp-input">
            <option value="">All languages</option>
            <option v-for="lang in languageOptions" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-stone-500 mb-1">Title or author</label>
          <div class="relative">
            <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="e.g. Le Petit Prince"
              class="gp-input pl-9 pr-9"
              @input="onInput"
              @keydown.enter="searchNow"
            />
            <button
              v-if="query"
              type="button"
              @click="clearSearch"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              aria-label="Clear search"
            >
              <X :size="15" />
            </button>
          </div>
        </div>
      </div>
      <p v-if="selectedLanguageName && languageCode" class="text-xs text-stone-400 -mt-1">
        Showing only books in {{ selectedLanguageName }}.
      </p>

      <!-- Recent searches — only when the input is empty. -->
      <div v-if="!query && recent.length" class="flex flex-wrap items-center gap-1.5 pt-1">
        <span class="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mr-1">Recent</span>
        <button
          v-for="r in recent"
          :key="r"
          type="button"
          @click="useRecent(r)"
          class="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-line text-stone-600 hover:border-garden-400 hover:text-garden-700 transition-colors"
        >
          {{ r }}
        </button>
        <button
          type="button"
          @click="clearRecent"
          class="ml-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Filter + sort row — only meaningful when a query has been run. -->
    <div v-if="hasSearched" class="flex flex-wrap items-center gap-2">
      <!-- Sort chips -->
      <div class="inline-flex items-center gap-1 p-0.5 rounded-lg bg-stone-100">
        <button
          v-for="s in SORT_OPTIONS"
          :key="s.key"
          type="button"
          @click="setSort(s.key)"
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1"
          :class="sort === s.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'"
        >
          <component :is="s.icon" :size="11" />
          {{ s.label }}
        </button>
      </div>

      <!-- Filter chips -->
      <button
        v-for="f in PAGE_RANGE_FILTERS"
        :key="f.key"
        type="button"
        @click="togglePageRange(f.key)"
        class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
        :class="filters.pageRange === f.key
          ? 'bg-garden-600 text-white border-transparent shadow-pill'
          : 'bg-white border-line text-stone-600 hover:border-garden-400 hover:text-garden-700'"
        :title="f.title"
      >
        {{ f.label }}
      </button>
      <button
        type="button"
        @click="toggleFilter('hasDescription')"
        class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1"
        :class="filters.hasDescription
          ? 'bg-garden-600 text-white border-transparent shadow-pill'
          : 'bg-white border-line text-stone-600 hover:border-garden-400 hover:text-garden-700'"
      >
        <FileText :size="11" /> Has description
      </button>
      <button
        type="button"
        @click="toggleFilter('hasPageCount')"
        class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1"
        :class="filters.hasPageCount
          ? 'bg-garden-600 text-white border-transparent shadow-pill'
          : 'bg-white border-line text-stone-600 hover:border-garden-400 hover:text-garden-700'"
      >
        <Hash :size="11" /> Has page count
      </button>
      <button
        type="button"
        @click="toggleFilter('alreadySaved')"
        class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1"
        :class="filters.alreadySaved
          ? 'bg-garden-600 text-white border-transparent shadow-pill'
          : 'bg-white border-line text-stone-600 hover:border-garden-400 hover:text-garden-700'"
      >
        <BookCheck :size="11" /> In your library
      </button>
      <span v-if="filterCount > 0" class="text-[11px] text-stone-400 ml-1">
        {{ filteredResults.length }} / {{ results.length }} match
      </span>
      <button
        v-if="filterCount > 0"
        type="button"
        @click="clearFilters"
        class="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
      >
        Clear filters
      </button>
    </div>

    <!-- Result states -->
    <template v-if="isActive || hasSearched">
      <!-- Loading first page -->
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
      <div v-else-if="filteredResults.length">
        <div class="flex items-center justify-between mb-2.5">
          <p class="text-[11px] text-stone-400">
            Showing {{ filteredResults.length }} {{ filteredResults.length === 1 ? 'book' : 'books' }}<span v-if="sourceLabel"> · {{ sourceLabel }}</span>
          </p>
          <p v-if="filterCount > 0" class="text-[11px] text-stone-400 sm:hidden">
            {{ filteredResults.length }} / {{ results.length }}
          </p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BookResultCard
            v-for="book in filteredResults"
            :key="book.externalId"
            :book="book"
            :saved="savedIds.includes(book.externalId)"
            @save="$emit('save', $event)"
          />
        </div>
        <div v-if="hasMore" class="text-center mt-4">
          <button
            type="button"
            @click="loadMore"
            :disabled="loadingMore"
            class="px-4 py-2 rounded-full text-sm font-medium bg-white border border-line text-stone-600 hover:border-garden-400 hover:text-garden-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Loader2 v-if="loadingMore" :size="13" class="animate-spin" />
            <ChevronDown v-else :size="13" />
            {{ loadingMore ? 'Loading more…' : 'Show more' }}
          </button>
        </div>
      </div>

      <!-- Empty after a search -->
      <div v-else-if="hasSearched" class="text-center py-10 text-stone-400">
        <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p class="text-sm">No books found{{ selectedLanguageName ? ` in ${selectedLanguageName}` : '' }}{{ filterCount > 0 ? ' with these filters' : '' }}.</p>
        <p v-if="filterCount > 0" class="text-xs mt-2">
          <button type="button" @click="clearFilters" class="text-garden-600 hover:text-garden-700 underline">
            Clear filters
          </button>
        </p>
      </div>
    </template>

    <!-- Recommendation strip: "More by *author*". Only renders when the
         composable produced a seed AND the user is not currently searching
         (otherwise the recs would compete with the active results for room). -->
    <div
      v-if="!isActive && recommendations.length"
      class="pt-3 border-t border-line"
    >
      <div class="flex items-center justify-between mb-2.5">
        <h4 class="gp-title text-sm uppercase tracking-wider text-stone-500 inline-flex items-center gap-1.5">
          <Sparkles :size="12" />
          More by {{ recommendations[0]?.author || recommendationTitle?.author }}
        </h4>
        <span class="text-[11px] text-stone-400">{{ recommendations.length }} suggestions</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <BookResultCard
          v-for="book in recommendations"
          :key="book.externalId"
          :book="book"
          :saved="savedIds.includes(book.externalId)"
          @save="$emit('save', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  Search, BookOpen, X, Loader2, ChevronDown, FileText, Hash, BookCheck, Sparkles,
  ArrowDownAZ, Calendar, Star,  // placeholder icons for sort options
} from 'lucide-vue-next'
import { useBookSearch } from '../../composables/useBookSearch.js'
import { codeForName, nameForCode } from '../../lib/bookLanguages.js'
import BookResultCard from './BookResultCard.vue'

const props = defineProps({
  savedIds: { type: Array, default: () => [] },
  defaultLanguageCode: { type: String, default: null },
  // The user's tracked Garten languages — the dropdown lists all of them by
  // name. The ISO-639-1 code is used for the book search only when available.
  languages: { type: Array, default: () => [] },
  // Saved books, used to feed the recommendation seed and the "In your library"
  // secondary filter. Caller passes them in so the composable stays stateless
  // about library state.
  savedBooks: { type: Array, default: () => [] },
})

const emit = defineEmits(['save'])

// The "Already saved" filter needs a Set of externalIds; the savedBooks prop
// is the source of truth. We pass a getter so the composable sees live updates
// when the user saves a book.
const savedExternalIds = () => new Set(props.savedIds)
const search = useBookSearch({ savedExternalIds })

const {
  query,
  languageCode,
  filteredResults,
  results,
  sources,
  sort,
  filters,
  loading,
  loadingMore,
  error,
  hasSearched,
  hasMore,
  recent,
  clearRecent,
  setSort,
  setFilter,
  clearFilters,
  cleanup,
  loadMore,
  searchNow,
  setLanguage,
  recommendations,
  recommendationsLoading,
  recommendationTitle,
  loadRecommendations,
} = search

const selectedLanguageId = ref('')
const searchInput = ref(null)

// "Active" means the user is in the middle of searching. We treat typing or
// having a non-empty query as active; the rec strip only shows when not active.
const isActive = computed(() => query.value.trim().length > 0)
watch(isActive, (active) => {
  // Emit so the parent can decide if it wants to gate the rec strip.
  emit('active', active)
})

const SORT_OPTIONS = [
  { key: 'relevance', label: 'Relevance', icon: ArrowDownAZ },
  { key: 'shortest', label: 'Shortest', icon: Hash },
  { key: 'newest', label: 'Newest', icon: Calendar },
]
const PAGE_RANGE_FILTERS = [
  { key: 'short', label: '< 150 pages', title: 'Short reads' },
  { key: 'medium', label: '150–400', title: 'Medium reads' },
  { key: 'long', label: '400+', title: 'Long reads' },
]

const filterCount = computed(() => {
  let n = 0
  if (filters.value.pageRange) n++
  if (filters.value.hasDescription) n++
  if (filters.value.hasPageCount) n++
  if (filters.value.alreadySaved) n++
  return n
})

const languageOptions = computed(() =>
  (props.languages || []).map((l) => ({
    id: l.id,
    name: l.name,
    code: codeForName(l.name) || null,
  }))
)

const selectedLanguage = computed(() =>
  languageOptions.value.find((l) => l.id === selectedLanguageId.value)
)

const selectedLanguageName = computed(() => selectedLanguage.value?.name)

// Source attribution. When both contribute, show both; when only one, show
// just that one. When none (empty query), show nothing.
const sourceLabel = computed(() => {
  const arr = [...sources.value]
  if (arr.length === 2) return 'Google Books · Open Library'
  if (arr[0] === 'google') return 'Google Books'
  if (arr[0] === 'openlibrary') return 'Open Library'
  if (arr[0] === 'merged') return 'Google Books · Open Library'
  return null
})

// If the selected language is removed from the user's garden, reset the filter.
watch(languageOptions, (opts) => {
  if (selectedLanguageId.value && !opts.find((l) => l.id === selectedLanguageId.value)) {
    selectLanguage('')
  }
})

onMounted(() => {
  if (props.defaultLanguageCode) {
    const match = languageOptions.value.find((l) => l.code === props.defaultLanguageCode)
    if (match) selectLanguage(match.id)
  }
  // Seed recommendations on first mount. The composable does nothing when
  // the user has no finished books.
  loadRecommendations(props.savedBooks)
})

onBeforeUnmount(cleanup)

// Refresh recommendations when the saved-books list changes (e.g. a new
// book was just finished). Watch the prop shallowly — deep watching would
// re-fetch on every progress log.
watch(() => props.savedBooks.length, () => {
  if (!isActive.value) loadRecommendations(props.savedBooks)
})

function onInput() {
  search()
}

function clearSearch() {
  query.value = ''
  searchNow()
  searchInput.value?.focus()
}

function selectLanguage(id) {
  selectedLanguageId.value = id || ''
  const lang = languageOptions.value.find((l) => l.id === id)
  setLanguage(lang?.code || null)
}

function onLanguageChange(e) {
  selectLanguage(e.target.value)
}

function toggleFilter(key) {
  setFilter(key, !filters.value[key])
}

function togglePageRange(key) {
  setFilter('pageRange', filters.value.pageRange === key ? null : key)
}

function useRecent(r) {
  query.value = r
  searchNow()
}
</script>
