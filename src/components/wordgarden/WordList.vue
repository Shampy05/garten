<template>
  <div class="space-y-3">
    <!-- Per-language filter chips — always visible (even with 1 language) so
         the filter affordance is discoverable. With one language the "All"
         chip and the language chip are functionally equivalent; with 2+
         languages they narrow the list to a specific garden. Shared with the
         Plant-a-word form: a single languageFilter lives in the parent so
         picking a language in the form narrows this list and vice versa. -->
    <div v-if="languagesPresent.length" class="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        @click="setFilter(null)"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        :class="!languageFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        All
      </button>
      <button
        v-for="lang in languagesPresent"
        :key="lang.id"
        type="button"
        @click="setFilter(lang.id)"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5"
        :class="languageFilter === lang.id ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color || '#a8a29e' }"></span>
        {{ lang.name }}
        <span class="tabular-nums opacity-70">{{ lang.count }}</span>
      </button>

      <!-- Multi-select affordance — only when there's something to remove.
           A small, secondary button so it doesn't fight the active watering
           round for attention. -->
      <button
        v-if="scoped.length > 1 && !selectMode"
        type="button"
        @click="enterSelectMode"
        class="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-line text-stone-500 hover:border-stone-300 transition-colors inline-flex items-center gap-1.5"
      >
        <CheckSquare :size="11" />
        Select
      </button>
    </div>

    <!-- Tag filter chips — a second, independent filter dimension (combines
         with the language filter via AND) for themed collections ("kitchen",
         "trip to Berlin") that cut across languages. Only shown when the
         current language scope actually has tagged words. -->
    <div v-if="tagsPresent.length" class="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        @click="tagFilter = null"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        :class="!tagFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        All tags
      </button>
      <button
        v-for="t in tagsPresent"
        :key="t.tag"
        type="button"
        @click="tagFilter = tagFilter === t.tag ? null : t.tag"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        :class="tagFilter === t.tag ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        {{ t.tag }} <span class="tabular-nums opacity-70">{{ t.count }}</span>
      </button>
      <button
        v-if="tagFilter && allDueInScope.length"
        type="button"
        @click="$emit('review-tag', allDueInScope.map((w) => w.id))"
        class="px-2.5 py-1 rounded-full text-xs font-medium bg-garden-50 border border-garden-200 text-garden-700 hover:bg-garden-100 transition-colors inline-flex items-center gap-1"
      >
        <Droplets :size="11" />
        Review {{ allDueInScope.length }} in “{{ tagFilter }}”
      </button>
    </div>

    <!-- ── Deck 1: Due today ("Needs water") ───────────────────────── -->
    <section class="gp-card overflow-hidden">
      <div class="w-full flex items-center gap-3 px-4 py-3 bg-garden-50/50">
        <button
          type="button"
          @click="decksOpen.due = !decksOpen.due"
          class="flex items-center gap-3 flex-1 min-w-0 text-left"
          :aria-expanded="decksOpen.due"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0 bg-garden-500" />
          <Droplets :size="14" class="text-garden-600 flex-shrink-0" />
          <h3 class="font-display text-sm font-bold text-stone-800 flex-1">Needs water</h3>
          <span class="text-xs text-stone-500 tabular-nums">{{ dueWords.length }}</span>
        </button>
        <!-- Opens a review round scoped to exactly the (filtered) due words
             visible here — same forceIds plumbing as the tag-scoped round
             below, just triggered from the deck itself instead of a tag chip. -->
        <button
          v-if="dueWords.length"
          type="button"
          @click="$emit('review-tag', dueWords.map((w) => w.id))"
          class="px-2.5 py-1 rounded-full text-xs font-medium bg-garden-600 text-white hover:bg-garden-700 transition-colors inline-flex items-center gap-1 flex-shrink-0"
        >
          <Droplets :size="11" />
          Water these {{ dueWords.length }}
        </button>
        <ChevronDown
          :size="14"
          class="text-stone-400 transition-transform flex-shrink-0 cursor-pointer"
          :class="decksOpen.due ? 'rotate-180' : ''"
          @click="decksOpen.due = !decksOpen.due"
        />
      </div>
      <div v-if="decksOpen.due" class="border-t border-line">
        <div v-if="dueWords.length === 0" class="px-4 py-3 text-sm text-stone-400 italic">
          {{ dueEmptyMessage }}
        </div>
        <div v-else class="p-3 space-y-2">
          <WordRow
            v-for="word in dueWords"
            :key="word.id"
            :word="word"
            :just-advanced="advancedIds.has(word.id)"
            :select-mode="selectMode"
            :selected="selectedIds.has(word.id)"
            :language-color="colorFor(word.languageId)"
            :language-code="codeFor(word.languageId)"
            :language-name="nameFor(word.languageId)"
            :source-title="sourceTitles[word.sourceBookId] || null"
            @update="$emit('update', $event)"
            @remove="$emit('remove', $event)"
            @toggle="onWordToggle(word)"
            @enter-select="onEnterSelect(word)"
            @filter-tag="tagFilter = $event"
          />
        </div>
      </div>
    </section>

    <!-- ── Deck 2: New (never reviewed) ────────────────────────────── -->
    <section class="gp-card overflow-hidden">
      <button
        type="button"
        @click="decksOpen.new = !decksOpen.new"
        class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
        :aria-expanded="decksOpen.new"
      >
        <span class="w-2 h-2 rounded-full flex-shrink-0 bg-stone-400" />
        <Leaf :size="14" class="text-stone-500 flex-shrink-0" />
        <h3 class="font-display text-sm font-bold text-stone-800 flex-1">New</h3>
        <span class="text-xs text-stone-500 tabular-nums">{{ newWords.length }}</span>
        <ChevronDown :size="14" class="text-stone-400 transition-transform flex-shrink-0" :class="decksOpen.new ? 'rotate-180' : ''" />
      </button>
      <div v-if="decksOpen.new" class="border-t border-line">
        <div v-if="newWords.length === 0" class="px-4 py-3 text-sm text-stone-400 italic">
          No new words waiting — plant more from a book or the form above.
        </div>
        <!-- Seed tray: seeds haven't earned a full row's visual weight yet —
             a dense grid of term-only tiles, soil-toned. Tap a tile to reveal
             its full card (meaning, pills, edit/remove) inline; tap again to
             collapse. Multi-select falls back to the normal row list so
             long-press/tap selection works identically across every deck. -->
        <div v-else-if="!selectMode" class="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <template v-for="word in newWords" :key="word.id">
            <button
              v-if="!expandedSeeds.has(word.id)"
              type="button"
              @click="expandedSeeds.add(word.id)"
              class="text-left px-3 py-2.5 rounded-xl bg-garden-soil border border-line hover:border-stone-300 transition-colors"
            >
              <span class="flex items-center gap-1.5 min-w-0">
                <VocabStageGlyph stage="seed" :color="colorFor(word.languageId)" :size="14" />
                <span class="text-sm font-semibold text-stone-800 truncate">{{ word.term }}</span>
              </span>
            </button>
            <div v-else class="col-span-2 sm:col-span-3">
              <WordRow
                :word="word"
                :just-advanced="advancedIds.has(word.id)"
                :select-mode="selectMode"
                :selected="selectedIds.has(word.id)"
                :language-color="colorFor(word.languageId)"
                :language-code="codeFor(word.languageId)"
                :language-name="nameFor(word.languageId)"
                :source-title="sourceTitles[word.sourceBookId] || null"
                @update="$emit('update', $event)"
                @remove="$emit('remove', $event)"
                @toggle="onWordToggle(word)"
                @enter-select="onEnterSelect(word)"
                @filter-tag="tagFilter = $event"
              />
              <button
                type="button"
                @click="expandedSeeds.delete(word.id)"
                class="text-[11px] text-stone-400 hover:text-stone-600 mt-1 ml-1"
              >
                Collapse
              </button>
            </div>
          </template>
        </div>
        <div v-else class="p-3 space-y-2">
          <WordRow
            v-for="word in newWords"
            :key="word.id"
            :word="word"
            :just-advanced="advancedIds.has(word.id)"
            :select-mode="selectMode"
            :selected="selectedIds.has(word.id)"
            :language-color="colorFor(word.languageId)"
            :language-code="codeFor(word.languageId)"
            :language-name="nameFor(word.languageId)"
            :source-title="sourceTitles[word.sourceBookId] || null"
            @update="$emit('update', $event)"
            @remove="$emit('remove', $event)"
            @toggle="onWordToggle(word)"
            @enter-select="onEnterSelect(word)"
            @filter-tag="tagFilter = $event"
          />
        </div>
      </div>
    </section>

    <!-- ── Deck 3: Mature (stage ≥ 2) ──────────────────────────────── -->
    <section class="gp-card overflow-hidden">
      <button
        type="button"
        @click="decksOpen.mature = !decksOpen.mature"
        class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
        :aria-expanded="decksOpen.mature"
      >
        <span class="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" />
        <Sparkles :size="14" class="text-stone-500 flex-shrink-0" />
        <h3 class="font-display text-sm font-bold text-stone-800 flex-1">Mature</h3>
        <span class="text-xs text-stone-500 tabular-nums">{{ matureWords.length }}</span>
        <ChevronDown :size="14" class="text-stone-400 transition-transform flex-shrink-0" :class="decksOpen.mature ? 'rotate-180' : ''" />
      </button>
      <div v-if="decksOpen.mature" class="border-t border-line">
        <div v-if="matureWords.length === 0" class="px-4 py-3 text-sm text-stone-400 italic">
          Nothing mature yet — keep watering.
        </div>
        <div v-else class="p-3 space-y-3">
          <WordRow
            v-for="word in matureWords"
            :key="word.id"
            :word="word"
            size="lg"
            :just-advanced="advancedIds.has(word.id)"
            :select-mode="selectMode"
            :selected="selectedIds.has(word.id)"
            :language-color="colorFor(word.languageId)"
            :language-code="codeFor(word.languageId)"
            :language-name="nameFor(word.languageId)"
            :source-title="sourceTitles[word.sourceBookId] || null"
            @update="$emit('update', $event)"
            @remove="$emit('remove', $event)"
            @toggle="onWordToggle(word)"
            @enter-select="onEnterSelect(word)"
            @filter-tag="tagFilter = $event"
          />
        </div>
      </div>
    </section>

    <!-- Multi-select floating action bar. Sits at the bottom of the screen
         and is sticky so it's always in reach during long multi-card
         selections. Tapping Remove asks for a confirm via the parent. -->
    <Transition name="rise">
      <div
        v-if="selectMode"
        class="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pointer-events-none"
      >
        <div class="gp-card shadow-hero flex items-center gap-2 px-3 py-2 max-w-md w-full pointer-events-auto">
          <span class="text-sm text-stone-700 tabular-nums flex-1 min-w-0">
            <span class="font-semibold">{{ selectedIds.size }}</span> selected
          </span>
          <button
            v-if="selectedIds.size < scoped.length"
            type="button"
            @click="selectAllVisible"
            class="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-800 transition-colors"
          >
            Select all ({{ scoped.length }})
          </button>
          <button
            type="button"
            @click="exitSelectMode"
            class="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="!selectedIds.size"
            @click="confirmBulkRemove"
            class="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Trash2 :size="12" />
            Remove
          </button>
        </div>
      </div>
    </Transition>

    <!-- Confirm dialog for bulk remove. Reuses the visual language of the
         single-word remove flow but shows how many words are about to go. -->
    <ConfirmDialog
      :visible="showBulkConfirm"
      :title="`Remove ${bulkConfirmIds.length} ${bulkConfirmIds.length === 1 ? 'word' : 'words'}?`"
      :message="`This pulls ${bulkConfirmIds.length === 1 ? 'it' : 'them'} out of your garden, along with ${bulkConfirmIds.length === 1 ? 'its' : 'their'} review history. This cannot be undone.`"
      confirm-label="Remove"
      danger
      @confirm="executeBulkRemove"
      @cancel="showBulkConfirm = false"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Droplets, Leaf, Sparkles, ChevronDown, CheckSquare, Trash2 } from 'lucide-vue-next'
import { isDue, wordDeck } from '../../lib/srs.js'
import { codeForName } from '../../lib/bookLanguages.js'
import WordRow from './WordRow.vue'
import VocabStageGlyph from './VocabStageGlyph.vue'
import ConfirmDialog from '../ConfirmDialog.vue'

const props = defineProps({
  words: { type: Array, default: () => [] },
  // The user's tracked languages ({ id, name, color }) for chip labels/colors.
  languages: { type: Array, default: () => [] },
  // sourceBookId → title map, resolved by the parent (soft references).
  sourceTitles: { type: Object, default: () => ({}) },
  // Active language filter, owned by the parent so the Plant-a-word form
  // shares it. `null` = show all languages.
  languageFilter: { type: String, default: null },
  // Word ids that just crossed a growth-stage glyph in the review session
  // that closed moments ago — the post-review return moment plays a one-time
  // grow-in flash on these when they resurface here. See WordGardenView.
  advancedIds: { type: Set, default: () => new Set() },
})

const emit = defineEmits(['update', 'remove', 'update:languageFilter', 'bulk-remove', 'review-tag'])

const langById = computed(() => new Map(props.languages.map((l) => [l.id, l])))

function colorFor(languageId) {
  return langById.value.get(languageId)?.color || null
}

// ISO 639-1 code for a tracked language, used to thread the language hint
// through to the Wiktionary lookup. Returns null for words whose language
// was deleted from the user's garden — the lookup then falls back to a
// broader REST search that doesn't need a section hint.
function codeFor(languageId) {
  const lang = langById.value.get(languageId)
  return lang ? codeForName(lang.name) : null
}

// Display name, threaded down to WordCard so it can look up which
// grammatical genders (if any) that language has.
function nameFor(languageId) {
  return langById.value.get(languageId)?.name || null
}

function setFilter(id) {
  emit('update:languageFilter', id)
}

const filterName = computed(() => langById.value.get(props.languageFilter)?.name || '')

// Languages that actually have words, with counts. A language whose row was
// deleted still shows under its raw id so the words remain reachable.
const languagesPresent = computed(() => {
  const counts = new Map()
  for (const w of props.words) counts.set(w.languageId, (counts.get(w.languageId) || 0) + 1)
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      count,
      name: langById.value.get(id)?.name || id,
      color: langById.value.get(id)?.color || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const languageScoped = computed(() => props.words.filter((w) => !props.languageFilter || w.languageId === props.languageFilter))

// Tags present within the current language scope, not the full word list —
// switching to German shouldn't still show a Welsh-only tag chip. Counts
// help the gardener see which collections are worth reviewing.
const tagsPresent = computed(() => {
  const counts = new Map()
  for (const w of languageScoped.value) {
    for (const tag of w.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
})

const tagFilter = ref(null)

// A tag from a different language's word would be a stale, confusing
// selection once the language chip changes — same reset instinct as the
// gender pill clearing on a language change in WordCaptureForm.
watch(() => props.languageFilter, () => { tagFilter.value = null })

const scoped = computed(() =>
  languageScoped.value.filter((w) => !tagFilter.value || (w.tags || []).includes(tagFilter.value))
)

// All currently-due words in scope, regardless of new-vs-returning — used
// by the tag-scoped review trigger above, which should offer every due
// word under a tag (including brand-new ones), not just the "returning"
// subset the Needs Water deck below displays.
const allDueInScope = computed(() => scoped.value.filter((w) => isDue(w)))

// Three decks, in priority order: new → due → mature. Bucketing itself
// lives in wordDeck() (src/lib/srs.js, tested) — see the comment there for
// why this is keyed on reviewCount rather than stage/due-date (the previous
// due-date-based split made "New" permanently unreachable).
const dueWords = computed(() =>
  scoped.value
    .filter((w) => wordDeck(w) === 'due')
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
)
const newWords = computed(() =>
  scoped.value
    .filter((w) => wordDeck(w) === 'new')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
)
const matureWords = computed(() =>
  scoped.value
    .filter((w) => wordDeck(w) === 'mature')
    .sort((a, b) => (Number(b.stage) || 0) - (Number(a.stage) || 0) || String(b.lastReviewedAt || '').localeCompare(String(a.lastReviewedAt || '')))
)

const dueEmptyMessage = computed(() =>
  props.languageFilter && filterName.value
    ? `No ${filterName.value} words due. Tap a language chip to switch.`
    : 'Nothing due today — your words are all watered. Plant more from a book.'
)

// Open state per deck. Due is open by default (the active watering target),
// New is open so the user can see their seed pile, Mature is collapsed
// since it grows large over time.
const decksOpen = reactive({ due: true, new: true, mature: false })

// Seed-tray expansion — which New-deck words are showing their full card
// instead of the compact tile. Local, ephemeral UI state (not persisted);
// resets naturally on remount.
const expandedSeeds = reactive(new Set())

// ── Multi-select state ───────────────────────────────────────────────
const selectMode = ref(false)
const selectedIds = reactive(new Set())

function enterSelectMode() {
  selectMode.value = true
  selectedIds.clear()
}

function exitSelectMode() {
  selectMode.value = false
  selectedIds.clear()
}

function onEnterSelect(word) {
  if (!selectMode.value) {
    selectMode.value = true
  }
  selectedIds.add(word.id)
}

function onWordToggle(word) {
  if (!selectMode.value) {
    selectMode.value = true
  }
  if (selectedIds.has(word.id)) selectedIds.delete(word.id)
  else selectedIds.add(word.id)
  // Auto-exit when the last selection is removed.
  if (selectMode.value && selectedIds.size === 0) {
    selectMode.value = false
  }
}

function selectAllVisible() {
  for (const w of scoped.value) selectedIds.add(w.id)
}

const showBulkConfirm = ref(false)
const bulkConfirmIds = ref([])
function confirmBulkRemove() {
  if (!selectedIds.size) return
  bulkConfirmIds.value = [...selectedIds]
  showBulkConfirm.value = true
}
async function executeBulkRemove() {
  showBulkConfirm.value = false
  if (!bulkConfirmIds.value.length) return
  emit('bulk-remove', bulkConfirmIds.value)
  // Optimistic UI: drop the selection now, parent will roll back via
  // toast on error. (useVocab's removeWords is the source of truth.)
  selectedIds.clear()
  selectMode.value = false
}
</script>