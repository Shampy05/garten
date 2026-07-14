<template>
  <div>
    <!-- Collapsed state -->
    <div v-if="step === 0">
      <button
        @click="step = 1"
        class="gp-btn-primary w-full px-8 py-3.5 group"
      >
        <Sprout :size="16" class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6" />
        <span>Log a session</span>
      </button>

      <!-- One-tap "plant again" chips. The most-travelled path through the
           app is logging the same combo again, so surface up to 3 quiet
           suggestions derived from recent + frequent entries. The full
           stepper below stays for anything new.

           Visually distinct from the FilterBar pills (which are
           white-bordered rounded-full controls): filled stone-100, no
           border, lighter default text, with a small Repeat suffix that
           reads as "do it again" rather than "filter by". -->
      <div v-if="suggestions.length > 0" class="flex flex-wrap gap-1.5 mt-2.5">
        <button
          v-for="(s, i) in suggestions"
          :key="`${s.languageId}-${s.type}-${i}`"
          @click="quickLog(s)"
          class="group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium
                 bg-stone-100/80 text-stone-500
                 transition-colors duration-150
                 hover:bg-stone-200/80 hover:text-stone-700
                 active:scale-[0.97]"
          :title="`Log another ${nameFor(s.languageId)} · ${s.type} session`"
          :aria-label="`Log another ${nameFor(s.languageId)} ${s.type} session, ${formatDuration(s)}`"
        >
          <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ backgroundColor: colorFor(s.languageId) }"></span>
          <span class="truncate"><span class="font-semibold text-stone-700 group-hover:text-stone-800">{{ nameFor(s.languageId) }}</span> · {{ s.type }} · {{ formatDuration(s) }}</span>
          <RotateCcw :size="11" class="flex-shrink-0 opacity-50 group-hover:opacity-80 transition-opacity" />
        </button>
      </div>
    </div>

    <!-- Expanded state -->
    <div v-else class="gp-card gp-pad animate-grow-in">
      <div class="flex items-center justify-between mb-4">
        <h3 class="gp-title text-lg">Log a session</h3>
        <button @click="reset" class="text-sm text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
      </div>

      <!-- Progress dots -->
      <div class="flex items-center justify-center gap-0 mb-6">
        <template v-for="s in 4" :key="s">
          <div v-if="s > 1" class="w-8 h-0.5 rounded-full transition-colors duration-300"
            :class="s <= step ? 'bg-garden-400' : 'bg-stone-200'"
          ></div>
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300"
            :class="
              s === step ? 'bg-gradient-to-b from-garden-500 to-garden-600 text-white shadow-sm ring-2 ring-garden-200' :
              s < step ? 'bg-garden-100 text-garden-700' :
              'bg-stone-100 text-stone-400'
            "
          >
            <span v-if="s < step">✓</span>
            <span v-else>{{ s }}</span>
          </div>
        </template>
      </div>

      <!-- Step 1: Language -->
      <div v-if="step === 1" class="animate-fadeIn">
        <p class="text-sm text-stone-500 mb-3">Which language did you study?</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="lang in languages" :key="lang.id"
            @click="selectLanguage(lang)"
            class="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all border-2"
            :class="entry.languageId === lang.id
              ? 'border-garden-500 bg-garden-50 text-garden-700 shadow-sm'
              : 'border-line bg-white text-stone-700 hover:border-stone-300 hover:shadow-sm'"
            :style="entry.languageId === lang.id ? { borderColor: lang.color, backgroundColor: lang.color + '12', color: lang.color } : {}"
          >
            <span class="w-3.5 h-3.5 rounded-full flex-shrink-0" :style="{ backgroundColor: lang.color }"></span>
            {{ nameFor(lang.id) }}
          </button>
        </div>
      </div>

      <!-- Step 2: Type -->
      <div v-if="step === 2" class="animate-fadeIn">
        <p class="text-sm text-stone-500 mb-3">What type of activity?</p>
        <div v-if="availableTypes.length > 0" class="flex flex-wrap gap-2">
          <button
            v-for="type in availableTypes" :key="type"
            @click="selectType(type)"
            class="px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 capitalize"
            :class="entry.type === type
              ? 'border-garden-500 bg-garden-50 text-garden-700 shadow-sm'
              : 'border-line bg-white text-stone-600 hover:border-stone-300 hover:shadow-sm'"
          >
            {{ type }}
          </button>
        </div>
        <p v-else class="text-sm text-stone-400">No activity types defined. Add some in language settings.</p>
        <button @click="step--" class="mt-4 text-xs text-stone-500 hover:text-stone-700 transition-colors">← Back</button>
      </div>

      <!-- Step 3: Duration -->
      <div v-if="step === 3" class="animate-fadeIn">
        <!-- Optional book link — only for reading sessions, only when the
             gardener has a book actively "reading" in this language. Fully
             optional: skipping it leaves the rest of the flow untouched. -->
        <div v-if="entry.type === 'reading' && readingBooksForLanguage.length > 0" class="mb-5 pb-5 border-b border-stone-100">
          <p class="text-sm text-stone-500 mb-3">Reading one of these? <span class="text-stone-400">(optional)</span></p>
          <div class="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              v-for="b in readingBooksForLanguage" :key="b.id"
              type="button"
              @click="toggleBook(b)"
              class="flex-shrink-0 w-16 group"
              :title="b.title"
            >
              <div
                class="w-16 h-24 rounded-lg overflow-hidden bg-stone-100 border-2 transition-all flex items-center justify-center"
                :class="entry.bookId === b.id ? 'border-garden-500 shadow-sm' : 'border-transparent group-hover:border-stone-300'"
              >
                <img v-if="b.coverUrl" :src="b.coverUrl" :alt="b.title" class="w-full h-full object-cover" loading="lazy" />
                <BookOpen v-else :size="20" class="text-stone-300" />
              </div>
              <p class="text-[10px] text-stone-500 mt-1 truncate text-center">{{ b.title }}</p>
            </button>
          </div>
          <div v-if="entry.bookId" class="mt-3 flex items-center gap-2">
            <label class="text-xs text-stone-500" for="log-pages-read">Pages read</label>
            <input
              id="log-pages-read"
              v-model.number="entry.pagesRead"
              type="number"
              min="0"
              placeholder="optional"
              class="gp-input w-24 py-1.5 text-sm"
            />
          </div>
        </div>

        <p class="text-sm text-stone-500 mb-3">How long did you study?</p>
        <div class="grid grid-cols-3 gap-2 mb-4">
          <button v-for="preset in presets" :key="preset.label"
            @click="selectPreset(preset)"
            class="py-3 rounded-xl text-sm font-medium transition-all border-2"
            :class="activePreset === preset.label
              ? 'border-garden-500 bg-garden-50 text-garden-700'
              : 'border-line bg-white text-stone-600 hover:border-stone-300 hover:shadow-sm'"
          >
            {{ preset.label }}
          </button>
        </div>
        <div class="border-t border-stone-100 pt-3">
          <p class="text-xs text-stone-400 mb-2">Or set custom time:</p>
          <div class="flex gap-2 items-end">
            <div>
              <label class="block text-xs text-stone-400 mb-1">Hours</label>
              <input v-model.number="entry.hours" type="number" min="0" max="24" placeholder="0"
                class="gp-input w-20 py-2"
              />
            </div>
            <div>
              <label class="block text-xs text-stone-400 mb-1">Minutes</label>
              <input v-model.number="entry.minutes" type="number" min="0" max="59" placeholder="0"
                class="gp-input w-20 py-2"
              />
            </div>
            <button @click="step++"
              class="gp-btn-primary px-4 py-2 text-sm"
              :disabled="entry.hours === 0 && entry.minutes === 0"
            >
              Next →
            </button>
          </div>
        </div>
        <button @click="step--" class="mt-4 text-xs text-stone-500 hover:text-stone-700 transition-colors">← Back</button>
      </div>

      <!-- Step 4: Confirm -->
      <div v-if="step === 4" class="animate-fadeIn">
        <p class="text-sm text-stone-500 mb-4">Review your session.</p>
        <div class="bg-stone-50 rounded-xl p-4 space-y-3 border border-line">
          <div class="flex items-center justify-between">
            <span class="text-sm text-stone-500">Language</span>
            <span class="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full inline-block" :style="{ backgroundColor: selectedLanguage?.color }"></span>
              {{ selectedLanguage?.name }}
            </span>
          </div>
          <div class="border-t border-stone-200/70"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-stone-500">Type</span>
            <span class="text-sm font-semibold text-stone-800 capitalize">{{ entry.type }}</span>
          </div>
          <div class="border-t border-stone-200/70"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-stone-500">Duration</span>
            <span class="text-sm font-semibold text-stone-800 tabular-nums">{{ formatDuration(entry) }}</span>
          </div>
          <div class="border-t border-stone-200/70"></div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-stone-500">Date</span>
            <input v-model="entry.date" type="date"
              class="gp-input text-right py-1.5 w-40"
            />
          </div>
          <div class="border-t border-stone-200/70"></div>
          <div>
            <span class="text-sm text-stone-500">Notes (optional)</span>
            <textarea v-model="entry.notes" rows="2" placeholder="What did you study?"
              class="gp-input mt-1 resize-none"
            ></textarea>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button @click="step--" class="px-4 py-2.5 text-sm text-stone-500 hover:text-stone-700 transition-colors">← Back</button>
          <button @click="submitEntry"
            class="gp-btn-primary flex-1 py-3 group"
          >
            <Sprout :size="16" class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6" />
            <span>Plant seed</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Sprout, RotateCcw, BookOpen } from 'lucide-vue-next'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'
import { suggestQuickLogs } from '../lib/quickLogs.js'
import { codeForName } from '../lib/bookLanguages.js'

const props = defineProps({
  languages: {
    type: Array,
    required: true
  },
  // Used to derive quick-repeat chips. Optional — chips just don't render
  // when the parent doesn't pass them (e.g. the stepper is being used in
  // isolation outside the dashboard).
  entries: {
    type: Array,
    default: () => []
  },
  // The Reading Library's saved books (useBooks().savedBooks), so a reading
  // session can optionally link to a currently-reading book. Optional — the
  // book-picker just doesn't render when the parent doesn't pass any.
  savedBooks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['add-entry', 'quick-add'])

const { nameFor, colorFor, languageFor } = useLanguageLookup(() => props.languages)

const step = ref(0)
const today = new Date().toISOString().split('T')[0]
const activePreset = ref(null)

const entry = ref({
  languageId: '',
  type: '',
  hours: 0,
  minutes: 30,
  date: today,
  notes: '',
  // Optional reading-session link (Reading Library book + pages read).
  // Neither field is part of the entries table — App.vue strips them off
  // before saving the study entry and uses them to log book progress.
  bookId: null,
  pagesRead: null
})

const presets = [
  { label: '15m', hours: 0, minutes: 15 },
  { label: '30m', hours: 0, minutes: 30 },
  { label: '1h', hours: 1, minutes: 0 },
  { label: '1.5h', hours: 1, minutes: 30 },
  { label: '2h', hours: 2, minutes: 0 },
]

const selectedLanguage = computed(() => {
  return languageFor(entry.value.languageId)
})

const availableTypes = computed(() => {
  return selectedLanguage.value ? selectedLanguage.value.types : []
})

// Currently-reading books in the selected language only — a book "want to
// read" or already "read" isn't an active session to link against.
const readingBooksForLanguage = computed(() => {
  if (!selectedLanguage.value) return []
  const code = codeForName(selectedLanguage.value.name)
  if (!code) return []
  return props.savedBooks.filter((b) => b.languageCode === code && b.record?.status === 'reading')
})

// One-tap suggestions: most recent + most-frequent (14d) + filler, deduped
// and capped at 3. Filtered to languages the user still tracks — a chip for
// a deleted language is dead UI. Only shown when the stepper is collapsed,
// so opening the full flow never shows a competing shortcut.
const suggestions = computed(() => {
  if (step.value !== 0) return []
  const tracked = new Set(props.languages.map((l) => l.id))
  return suggestQuickLogs(props.entries)
    .filter((s) => tracked.has(s.languageId))
    .filter((s) => {
      // And the type still has to be a valid option for that language — a
      // user who removed "writing" from Spanish shouldn't see a Writing chip.
      const lang = languageFor(s.languageId)
      return lang && Array.isArray(lang.types) && lang.types.includes(s.type)
    })
})

function formatDuration(item) {
  const h = item.hours
  const m = item.minutes
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return '0m'
}

const selectLanguage = (lang) => {
  entry.value.languageId = lang.id
  entry.value.type = ''
  // The book picker is scoped to the selected language — clear any prior
  // pick so a stale book from a different language can't ship silently.
  entry.value.bookId = null
  entry.value.pagesRead = null
  step.value = (lang.types && lang.types.length > 0) ? 2 : 3
}

const selectType = (type) => {
  entry.value.type = type
  if (type !== 'reading') {
    entry.value.bookId = null
    entry.value.pagesRead = null
  }
  step.value = 3
}

// Tapping the same book again deselects it (it's optional, not a required
// pick). Clearing pagesRead alongside keeps it from shipping detached from
// a book once deselected.
const toggleBook = (book) => {
  entry.value.bookId = entry.value.bookId === book.id ? null : book.id
  if (!entry.value.bookId) entry.value.pagesRead = null
}

const selectPreset = (preset) => {
  activePreset.value = preset.label
  entry.value.hours = preset.hours
  entry.value.minutes = preset.minutes
  step.value = 4
}

const reset = () => {
  entry.value = { languageId: '', type: '', hours: 0, minutes: 30, date: today, notes: '', bookId: null, pagesRead: null }
  activePreset.value = null
  step.value = 0
}

const submitEntry = () => {
  if (!entry.value.languageId || !entry.value.type || (entry.value.hours === 0 && entry.value.minutes === 0) || !entry.value.date) return

  emit('add-entry', { ...entry.value })
  reset()
}

const quickLog = (combo) => {
  // Single-tap add: skip the stepper, fire the same add path, parent will
  // snapshot before/after for milestone detection + show the undo toast.
  // Validation is belt-and-suspenders — suggestions should already be
  // filtered to live languages / valid types above.
  const lang = languageFor(combo.languageId)
  if (!lang || !lang.types || !lang.types.includes(combo.type)) return
  if ((combo.hours === 0 && combo.minutes === 0)) return
  emit('quick-add', {
    languageId: combo.languageId,
    type: combo.type,
    hours: combo.hours,
    minutes: combo.minutes,
    date: today,
    notes: '',
  })
}
</script>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
