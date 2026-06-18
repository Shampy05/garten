<template>
  <div>
    <!-- Collapsed state -->
    <div v-if="step === 0">
      <button
        @click="step = 1"
        class="gp-btn-primary w-full px-8 py-3.5 group"
      >
        <span class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6">🌱</span>
        <span>Log a session</span>
      </button>
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
            {{ lang.name }}
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
        <p class="text-sm text-stone-500 mb-4">Review and plant your seed!</p>
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
            <span class="text-sm font-semibold text-stone-800 tabular-nums">{{ formatDuration }}</span>
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
            <span class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6">🌱</span>
            <span>Plant seed</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

const props = defineProps({
  languages: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['add-entry'])

const { languageFor } = useLanguageLookup(() => props.languages)

const step = ref(0)
const today = new Date().toISOString().split('T')[0]
const activePreset = ref(null)

const entry = ref({
  languageId: '',
  type: '',
  hours: 0,
  minutes: 30,
  date: today,
  notes: ''
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

const formatDuration = computed(() => {
  const h = entry.value.hours
  const m = entry.value.minutes
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return '0m'
})

const selectLanguage = (lang) => {
  entry.value.languageId = lang.id
  entry.value.type = ''
  step.value = (lang.types && lang.types.length > 0) ? 2 : 3
}

const selectType = (type) => {
  entry.value.type = type
  step.value = 3
}

const selectPreset = (preset) => {
  activePreset.value = preset.label
  entry.value.hours = preset.hours
  entry.value.minutes = preset.minutes
  step.value = 4
}

const reset = () => {
  entry.value = { languageId: '', type: '', hours: 0, minutes: 30, date: today, notes: '' }
  activePreset.value = null
  step.value = 0
}

const submitEntry = () => {
  if (!entry.value.languageId || !entry.value.type || (entry.value.hours === 0 && entry.value.minutes === 0) || !entry.value.date) return

  emit('add-entry', { ...entry.value })
  reset()
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
