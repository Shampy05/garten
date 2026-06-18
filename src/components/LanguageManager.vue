<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-24 px-4">
      <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" @click="$emit('close')"></div>

      <div class="relative gp-card shadow-hero w-full max-w-md max-h-[70vh] overflow-y-auto z-10 animate-grow-in">
        <!-- Header -->
        <div class="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-stone-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 class="gp-title text-lg text-stone-900">Language Seeds</h2>
          <div class="flex items-center gap-2">
            <button @click="showAddForm = !showAddForm"
              class="text-sm text-garden-600 hover:text-garden-700 font-medium transition-colors inline-flex items-center gap-1"
            >
              <Sprout :size="14" />
              New Seed
            </button>
            <button @click="$emit('close')"
              class="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-700 transition-colors"
            >
              <X :size="14" />
            </button>
          </div>
        </div>

        <!-- Add Language Form -->
        <div v-if="showAddForm" class="border-b border-stone-100 px-5 py-4 bg-stone-50/50">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-stone-600 mb-1">Language</label>
              <LanguageAutocomplete ref="autocompleteRef" :exclude="existingNames" @select="onLanguageSelect" />
            </div>
            <div>
              <label class="block text-xs font-medium text-stone-600 mb-1">Color</label>
              <div class="flex flex-wrap gap-2.5 mt-1">
                <button v-for="c in availableColors(color)" :key="c"
                  @click="color = c"
                  class="w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-black/10 transition-all"
                  :class="c.toLowerCase() === color?.toLowerCase() ? 'ring-2 ring-offset-2 ring-stone-500' : 'hover:scale-110'"
                  :style="{ backgroundColor: c }"
                >
                  <Check v-if="c.toLowerCase() === color?.toLowerCase()" class="w-4 h-4 text-white" :stroke-width="3.5" />
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-stone-600 mb-1">Activity Types</label>
              <div class="flex flex-wrap gap-1.5 mt-1">
                  <button
                    v-for="type in ACTIVITY_TYPES"
                    :key="type"
                    @click="toggleType(type)"
                    class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                    :class="selectedTypes.includes(type)
                      ? 'text-white border-transparent'
                      : 'text-stone-500 bg-stone-50 border-line hover:border-stone-300'"
                    :style="selectedTypes.includes(type) ? { backgroundColor: color, borderColor: color } : {}"
                  >
                    {{ type }}
                  </button>
                </div>
              </div>
            <button @click="addLanguage" :disabled="!selectedLanguage"
              class="gp-btn-primary w-full py-2 text-sm"
            >
              Add Seed
            </button>
          </div>
        </div>

        <!-- Native language -->
        <div class="border-b border-stone-100 px-5 py-4">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-[10px] text-stone-400 font-semibold uppercase tracking-widest">Your native language</span>
            <span class="relative group inline-flex">
              <span
                class="w-3.5 h-3.5 rounded-full border border-stone-300 text-stone-400 text-[9px] leading-none flex items-center justify-center cursor-help select-none"
                tabindex="0"
                aria-label="How native-language adjustment works"
              >?</span>
              <span class="pointer-events-none absolute left-0 top-5 z-20 hidden group-hover:block group-focus-within:block w-60 p-2.5 rounded-lg bg-gray-900 text-white text-[10px] font-normal normal-case tracking-normal leading-relaxed shadow-lg">
                Languages in the same family share vocabulary and grammar, so a related first
                language is a real head start (Spanish → Portuguese, say). We estimate the
                discount from how closely related your language is to each target, based on
                language-family trees. It only ever lowers a target, never raises it — and the
                hour figures stay rough estimates.
              </span>
            </span>
          </div>
          <select
            :value="nativeLanguage || ''"
            @change="$emit('set-native-language', $event.target.value || null)"
            class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-line bg-white text-stone-600 focus:outline-none focus:ring-2 focus:ring-garden-500/30"
          >
            <option value="">English (default)</option>
            <option v-for="name in NATIVE_OPTIONS" :key="name" :value="name">{{ name }}</option>
          </select>
          <p class="text-[10px] text-stone-300 mt-1.5 leading-relaxed">
            Closely related languages take less time. Setting this lowers the Fluency Horizon
            target where your first language gives you a head start — never raises it.
          </p>
        </div>

        <!-- Language Seed Packets -->
        <div class="px-5 py-4 space-y-3">
          <div v-for="lang in languages" :key="lang.id"
            class="rounded-xl overflow-hidden border-2 transition-all hover:shadow-md"
            :style="{ borderColor: lang.color + '40' }"
          >
            <div class="px-4 py-3 flex items-center gap-3" :style="{ backgroundColor: lang.color }">
              <div class="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-base shadow-inner">
                {{ lang.name[0].toUpperCase() }}
              </div>
              <span class="font-bold text-white drop-shadow-sm">{{ lang.name }}</span>
              <button @click.stop="confirmDeleteLanguage(lang)"
                class="ml-auto w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white/80 hover:text-white transition-colors flex-shrink-0"
                title="Remove language"
              ><X :size="14" /></button>
            </div>
            <div class="flex items-center justify-center" :style="{ backgroundColor: lang.color + '08' }">
              <div class="w-full border-t-2 border-dashed mx-3" :style="{ borderColor: lang.color + '30' }"></div>
            </div>
            <div class="px-4 py-3" :style="{ backgroundColor: lang.color + '04' }">
              <div class="text-[10px] text-stone-400 mb-1.5 font-semibold uppercase tracking-widest">Activity Types</div>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="type in lang.types" :key="type"
                  class="text-xs px-2.5 py-1 rounded-full font-medium"
                  :style="{ backgroundColor: lang.color + '30', color: lang.color }"
                >
                  {{ type }}
                </span>
              </div>

              <div class="mt-3 pt-3 border-t border-dashed" :style="{ borderColor: lang.color + '20' }">
                <div class="text-[10px] text-stone-400 mb-1.5 font-semibold uppercase tracking-widest">Color</div>
                <div class="flex flex-wrap gap-2.5">
                  <button v-for="c in availableColors(lang.color)" :key="c"
                    @click="updateColor(lang, c)"
                    :title="c.toLowerCase() === lang.color?.toLowerCase() ? 'Current color' : 'Use this color'"
                    class="w-7 h-7 rounded-full flex items-center justify-center ring-1 ring-black/10 transition-all"
                    :class="c.toLowerCase() === lang.color?.toLowerCase() ? 'ring-2 ring-offset-2 ring-stone-500' : 'hover:scale-110'"
                    :style="{ backgroundColor: c }"
                  >
                    <Check v-if="c.toLowerCase() === lang.color?.toLowerCase()" class="w-4 h-4 text-white" :stroke-width="3.5" />
                  </button>
                </div>
              </div>

              <div class="mt-3 pt-3 border-t border-dashed" :style="{ borderColor: lang.color + '20' }">
                <div class="text-[10px] text-stone-400 mb-1.5 font-semibold uppercase tracking-widest">Starting Point</div>
                <div class="flex items-center gap-2">
                  <select
                    :value="startLevel(lang)"
                    @change="updateStart(lang, $event.target.value)"
                    class="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-line bg-white text-stone-600 focus:outline-none focus:ring-2 focus:ring-garden-500/30"
                  >
                    <option v-for="level in LEVELS" :key="level.key" :value="level.key">{{ level.label }}</option>
                  </select>
                  <span class="text-[10px] text-stone-400 whitespace-nowrap">
                    {{ Math.round(Number(lang.prior_hours) || 0) }}h credited
                  </span>
                </div>
                <p class="text-[10px] text-stone-300 mt-1.5 leading-relaxed">
                  Roughly where you were before tracking — counts toward your fluency horizon.
                </p>
              </div>
            </div>
          </div>

          <div v-if="languages.length === 0" class="text-center py-8 text-stone-400">
            <Sprout :size="32" class="mx-auto mb-3 text-stone-300" />
            <p class="text-sm">No language seeds yet.</p>
            <p class="text-xs mt-1">Click "New Seed" to add your first language.</p>
          </div>
        </div>

        <!-- Export your data -->
        <div class="border-t border-stone-100 px-5 py-4">
          <div class="text-[10px] text-stone-400 mb-2 font-semibold uppercase tracking-widest">Export your data</div>
          <div class="flex items-center gap-2">
            <button
              @click="onExportCSV"
              :disabled="!hasData"
              class="flex-1 text-xs px-3 py-1.5 rounded-lg border border-line text-stone-600 hover:border-stone-300 hover:text-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              <Download :size="12" />
              Download CSV
            </button>
            <button
              @click="onExportJSON"
              :disabled="!hasData"
              class="flex-1 text-xs px-3 py-1.5 rounded-lg border border-line text-stone-600 hover:border-stone-300 hover:text-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              <Download :size="12" />
              Download JSON
            </button>
          </div>
          <p class="text-[10px] text-stone-300 mt-2 leading-relaxed">
            CSV is a flat session table for spreadsheets. JSON is a full snapshot with language
            names and a summary — handy for backups or feeding to an LLM.
          </p>
        </div>
      </div>
    </div>
  </Teleport>

  <ConfirmDialog
    :visible="showDeleteConfirm"
    title="Delete language?"
    :message="`This will permanently remove ${deleteTarget?.name} and all its logged sessions. This cannot be undone.`"
    confirm-label="Delete"
    danger
    @confirm="executeDelete"
    @cancel="cancelDelete"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import { Sprout, Plus, Download, X, Check } from 'lucide-vue-next'
import LanguageAutocomplete from './LanguageAutocomplete.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { ACTIVITY_TYPES } from '../lib/types.js'
import { PALETTE } from '../lib/color.js'
import { LEVELS, hoursForLevel, levelForHours, NATIVE_LANGUAGES } from '../lib/proficiency.js'
import { exportCSV, exportJSON } from '../lib/export.js'
import { useLanguageForm } from '../composables/useLanguageForm.js'

const props = defineProps({
  languages: {
    type: Array,
    required: true
  },
  entries: {
    type: Array,
    default: () => []
  },
  weeklyGoal: {
    type: Number,
    default: null
  },
  nativeLanguage: {
    type: String,
    default: null
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['add-language', 'delete-language', 'update-language', 'set-native-language', 'close'])

const NATIVE_OPTIONS = NATIVE_LANGUAGES

const existingNames = computed(() => props.languages.map(l => l.name))
const existingColors = computed(() => props.languages.map(l => l.color))
const usedColors = computed(() => new Set(existingColors.value.map(c => c?.toLowerCase())))
// Colors a language can pick: any not already owned by another language, plus
// its own current color. The picker shows just these real choices — no
// greyed-out "already taken" swatches to puzzle over.
const availableColors = (ownColor) =>
  PALETTE.filter(c =>
    !usedColors.value.has(c.toLowerCase()) || c.toLowerCase() === ownColor?.toLowerCase()
  )
const showAddForm = ref(false)
const { selectedLanguage, color, selectedTypes, autocompleteRef, onLanguageSelect, toggleType, getLanguageData, reset } = useLanguageForm(existingColors)

const deleteTarget = ref(null)
const showDeleteConfirm = ref(false)

function confirmDeleteLanguage(lang) {
  deleteTarget.value = lang
  showDeleteConfirm.value = true
}

function updateColor(lang, newColor) {
  emit('update-language', { id: lang.id, color: newColor })
}

function updateStart(lang, levelKey) {
  emit('update-language', { id: lang.id, prior_hours: hoursForLevel(lang.name, levelKey, props.nativeLanguage) })
}

function startLevel(lang) {
  return levelForHours(lang.name, lang.prior_hours, props.nativeLanguage)
}

const hasData = computed(() => props.entries.length > 0 || props.languages.length > 0)

function onExportCSV() {
  exportCSV(props.entries, props.languages)
}

function onExportJSON() {
  exportJSON(props.entries, props.languages, props.weeklyGoal)
}

function cancelDelete() {
  deleteTarget.value = null
  showDeleteConfirm.value = false
}

function executeDelete() {
  if (deleteTarget.value) {
    emit('delete-language', deleteTarget.value.id)
  }
  deleteTarget.value = null
  showDeleteConfirm.value = false
}

const addLanguage = () => {
  const data = getLanguageData()
  if (!data) return
  emit('add-language', data)
  reset()
  showAddForm.value = false
}
</script>
