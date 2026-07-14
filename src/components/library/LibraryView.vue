<template>
  <div class="animate-fade-up">
    <!-- Header -->
    <div class="gp-card gp-pad mb-6 relative overflow-hidden">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-garden-50/80 to-transparent"></div>
      <div class="relative flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-b from-garden-500 to-garden-600 text-white flex items-center justify-center flex-shrink-0 shadow-pill">
          <Library :size="22" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="font-display text-2xl font-bold text-stone-900 tracking-tight">Reading Library</h1>
          <p class="text-sm text-stone-500">Find books in your target language and track your reading.</p>
        </div>
        <!-- The search surface itself stays below the shelves; this anchors
             the affordance at the top so finding a new book never means
             scrolling past the whole library first. -->
        <button
          @click="jumpToSearch"
          class="gp-btn-ghost px-3 py-2 text-sm inline-flex items-center gap-1.5 flex-shrink-0"
        >
          <Search :size="14" />
          <span class="hidden sm:inline">Find a book</span>
        </button>
      </div>
    </div>

    <!-- One continuous surface: shelves (top), search (bottom). The search
         surface is no longer a swap — typing into it shrinks the libraries
         but never hides them, and the rec strip lives alongside results. -->
    <div class="space-y-8">
      <!-- Library: shelves -->
      <div class="space-y-5">
        <div v-if="!loaded && !loadError" class="text-center py-10 text-stone-400">
          <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50 animate-breathe" />
          <p class="text-sm">Gathering your books…</p>
        </div>
        <div v-else-if="loadError" class="gp-card gp-pad text-center text-stone-500 max-w-sm mx-auto">
          <p class="text-sm mb-3">We couldn't load your library.</p>
          <button @click="retryLoad" class="gp-btn-primary px-5 py-2 text-sm">Try again</button>
        </div>
        <div v-else-if="savedBooks.length === 0" class="gp-card gp-pad text-center text-stone-400 py-10">
          <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p class="text-sm text-stone-500">Your library is empty.</p>
          <p class="text-xs mt-1">Find a book below to start tracking.</p>
        </div>
        <template v-else>
          <ReadingSummary :saved-books="savedBooks" />
          <SavedBooksList
            :saved-books="savedBooks"
            :language-colors="languageColorMap"
            :entries="storageData.entries"
            :study-languages="languages"
            @edit="openEditModal"
            @remove="confirmRemove"
            @log="openLogModal"
            @quick-log="handleQuickLog"
            @capture-word="openCaptureWord"
          />
        </template>
      </div>

      <!-- Search: persistent surface, full width. -->
      <div id="library-search" class="pt-2 border-t border-line space-y-4">
        <div class="flex items-center gap-2">
          <h3 class="gp-title text-sm uppercase tracking-wider text-stone-500">Find a new book</h3>
          <span class="text-[11px] text-stone-400">Search Google Books and Open Library at once.</span>
        </div>
        <BookSearch
          ref="bookSearchRef"
          :saved-ids="savedIds"
          :default-language-code="defaultLanguageCode"
          :languages="languages"
          @save="openSaveModal"
          @active="searchActive = $event"
        />

        <!-- Discover rows — hidden while a search is active so suggestions
             never compete with live results for room. -->
        <DiscoverSection
          v-if="!searchActive"
          :saved-books="savedBooks"
          :saved-ids="savedIds"
          :entries="storageData.entries"
          :languages="languages"
          :ready="loaded && storageLoaded"
          @save="openSaveModal"
        />
      </div>
    </div>

    <SaveBookModal
      :book="saveTarget"
      :visible="showSaveModal"
      @save="handleSave"
      @close="showSaveModal = false"
    />

    <EditBookModal
      :book="editTarget"
      :visible="showEditModal"
      @save="handleEdit"
      @close="showEditModal = false"
    />

    <LogPagesModal
      :book="logTarget"
      :visible="showLogModal"
      :language-color="logTargetLanguageColor"
      @close="showLogModal = false"
      @logged="handleLogged"
    />

    <ConfirmDialog
      :visible="showRemoveConfirm"
      title="Remove book?"
      message="This removes the book and its reading record from your library. This cannot be undone."
      confirm-label="Remove"
      danger
      @confirm="executeRemove"
      @cancel="cancelRemove"
    />

    <!-- Capture-from-reading: a slim shell around the Word Garden's capture
         form, prefilled with the book's language and carrying its id as the
         word's (soft) source reference. -->
    <Teleport to="body">
      <div v-if="captureTarget" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="fixed inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="captureTarget = null"></div>
        <div class="relative min-h-full flex items-start sm:items-center justify-center p-4 sm:py-12" @click.self="captureTarget = null">
          <div class="relative w-full max-w-lg animate-grow-in">
            <div class="flex items-center justify-between mb-2 px-1">
              <p class="text-xs text-stone-500 truncate">
                A word from <span class="font-medium text-stone-700">{{ captureTarget.title }}</span>
              </p>
              <button
                @click="captureTarget = null"
                class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X :size="15" />
              </button>
            </div>
            <WordCaptureForm
              :languages="storageData.languages"
              :entries="storageData.entries"
              :preset-language-id="captureLanguageId"
              :source-book-id="captureTarget.id"
              @added="onWordCaptured"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Library, BookOpen, Search, X } from 'lucide-vue-next'
import { useBooks } from '../../composables/useBooks.js'
import { useStorage } from '../../composables/useStorage.js'
import { useToast } from '../../composables/useToast.js'
import { codeForName, nameForCode } from '../../lib/bookLanguages.js'
import { bookJustFinished } from '../../lib/finishCelebration.js'
import BookSearch from './BookSearch.vue'
import DiscoverSection from './DiscoverSection.vue'
import SavedBooksList from './SavedBooksList.vue'
import ReadingSummary from './ReadingSummary.vue'
import SaveBookModal from './SaveBookModal.vue'
import EditBookModal from './EditBookModal.vue'
import LogPagesModal from './LogPagesModal.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import WordCaptureForm from '../wordgarden/WordCaptureForm.vue'

const props = defineProps({
  // The user's tracked Garten languages — used only to default the search
  // language to one they're already studying.
  languages: { type: Array, default: () => [] },
})

const { savedBooks, loaded, loadError, saveBook, updateRecord, removeBook, retryLoad, quickLog } = useBooks()
const { addEntry, data: storageData, loaded: storageLoaded } = useStorage()
const toast = useToast()

const searchActive = ref(false)

// "Find a book" in the header: scroll to the search surface, then focus the
// query box once the scroll has (mostly) settled.
const bookSearchRef = ref(null)
function jumpToSearch() {
  const el = document.getElementById('library-search')
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  setTimeout(() => bookSearchRef.value?.focus(), reduced ? 0 : 400)
}

const languageColorMap = computed(() => {
  const map = {}
  for (const lang of props.languages) {
    map[codeForName(lang.name)] = lang.color
  }
  return map
})

const savedIds = computed(() => savedBooks.value.map((b) => b.externalId))

const defaultLanguageCode = computed(() => null)

// Save flow
const saveTarget = ref(null)
const showSaveModal = ref(false)
function openSaveModal(book) {
  saveTarget.value = book
  showSaveModal.value = true
}
async function handleSave({ volume, record }) {
  await saveBook(volume, record)
  showSaveModal.value = false
}

// Edit flow (FR10)
const editTarget = ref(null)
const showEditModal = ref(false)
function openEditModal(book) {
  editTarget.value = book
  showEditModal.value = true
}
async function handleEdit({ bookId, updates }) {
  await updateRecord(bookId, updates)
  showEditModal.value = false
}

// Log progress flow
const logTargetId = ref(null)
const showLogModal = ref(false)
const logTarget = computed(() =>
  savedBooks.value.find((b) => b.id === logTargetId.value) || null
)
const logTargetLanguageColor = computed(() => {
  if (!logTarget.value?.languageCode) return null
  return languageColorMap.value[logTarget.value.languageCode]
})
function openLogModal(book) {
  logTargetId.value = book.id
  showLogModal.value = true
}
async function handleLogged({ book, minutes }) {
  showLogModal.value = false
  logTargetId.value = null
  if (!minutes || minutes <= 0) return
  const lang = storageData.value.languages.find((l) => codeForName(l.name) === book.languageCode)
  if (!lang) return
  await addEntry({
    date: new Date().toISOString().slice(0, 10),
    languageId: lang.id,
    type: 'reading',
    hours: 0,
    minutes: Math.round(minutes),
    notes: `Reading: ${book.title}`,
  })
}

// Inline quick-log from the card. Same mutation as the modal's path, just
// without minutes/notes — the status-flip watcher below still fires the
// "Just finished" toast when a book hits 100%.
async function handleQuickLog({ book, pages }) {
  const result = await quickLog(book.id, pages)
  if (result?.error) {
    toast.error(result.error)
  }
}

// Detect a single status flip from `reading` to `read` and surface a quiet
// "Just finished" toast — the moment finishing a book becomes distinct from
// any other log. Dedupe-by-book via the per-book `celebrated` set so the same
// finish never toasts twice (e.g. on a hot reload or if savedBooks fires the
// watcher with a stale snapshot).
let prevSavedBooks = savedBooks.value.slice()
const celebrated = new Set()
watch(savedBooks, (curr) => {
  const finished = bookJustFinished(prevSavedBooks, curr)
  prevSavedBooks = curr.slice()
  if (!finished) return
  if (celebrated.has(finished.id)) return
  celebrated.add(finished.id)
  toast.show(`Finished “${finished.title}” — lovely work.`, 'celebrate', 6000)
}, { deep: true })

// Capture-from-reading — "Add a word" on a Reading card opens the Word
// Garden capture form with this book as the (soft) source.
const captureTarget = ref(null)
const captureLanguageId = computed(() => {
  if (!captureTarget.value?.languageCode) return null
  const lang = storageData.value.languages.find(
    (l) => codeForName(l.name) === captureTarget.value.languageCode
  )
  return lang?.id ?? null
})
function openCaptureWord(book) {
  captureTarget.value = book
}
function onWordCaptured(word) {
  captureTarget.value = null
  toast.show(`“${word.term}” planted in your Word Garden.`, 'success', 3500)
}

// Remove flow (FR11)
const removeTarget = ref(null)
const showRemoveConfirm = ref(false)
function confirmRemove(book) {
  removeTarget.value = book
  showRemoveConfirm.value = true
}
function cancelRemove() {
  removeTarget.value = null
  showRemoveConfirm.value = false
}
async function executeRemove() {
  if (removeTarget.value) await removeBook(removeTarget.value.id)
  removeTarget.value = null
  showRemoveConfirm.value = false
}
</script>
