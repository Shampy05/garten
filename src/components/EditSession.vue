<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-24 px-4">
      <div class="absolute inset-0 bg-stone-900/25 backdrop-blur-sm animate-fade-up" @click="$emit('close')"></div>
      <div class="relative gp-card shadow-hero w-full max-w-md z-10 p-5 space-y-4 animate-grow-in">
        <h2 class="gp-title text-lg text-stone-900">Edit Session</h2>

        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Language</label>
          <select v-model="form.languageId"
            class="gp-input"
          >
            <option v-for="lang in languages" :key="lang.id" :value="lang.id">{{ nameFor(lang.id) }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Type</label>
          <select v-model="form.type"
            class="gp-input capitalize"
          >
            <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="flex gap-3">
          <div class="flex-1">
            <label class="block text-xs font-medium text-stone-600 mb-1">Hours</label>
            <input v-model.number="form.hours" type="number" min="0" max="24"
              class="gp-input"
            />
          </div>
          <div class="flex-1">
            <label class="block text-xs font-medium text-stone-600 mb-1">Minutes</label>
            <input v-model.number="form.minutes" type="number" min="0" max="59"
              class="gp-input"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Date</label>
          <input v-model="form.date" type="date"
            class="gp-input"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Notes (optional)</label>
          <textarea v-model="form.notes" rows="2" placeholder="What did you study?"
            class="gp-input resize-none"
          ></textarea>
        </div>

        <div class="flex gap-2 pt-1">
          <button @click="$emit('close')"
            class="gp-btn-ghost flex-1 py-2.5 text-sm"
          >Cancel</button>
          <button @click="save"
            :disabled="!form.languageId || !form.type || (form.hours === 0 && form.minutes === 0)"
            class="gp-btn-primary flex-1 py-2.5 text-sm"
          >Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

const props = defineProps({
  entry: { type: Object, default: null },
  languages: { type: Array, required: true },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['save', 'close'])

const { nameFor, languageFor } = useLanguageLookup(() => props.languages)

const form = ref({ languageId: '', type: '', hours: 0, minutes: 0, date: '', notes: '' })

watch(() => props.visible, (v) => {
  if (v && props.entry) {
    form.value = {
      languageId: props.entry.languageId,
      type: props.entry.type,
      hours: props.entry.hours,
      minutes: props.entry.minutes,
      date: props.entry.date,
      notes: props.entry.notes || ''
    }
  }
})

const selectedLang = computed(() => languageFor(form.value.languageId))
const availableTypes = computed(() => selectedLang.value ? selectedLang.value.types : [])

function save() {
  if (!form.value.languageId || !form.value.type || (form.value.hours === 0 && form.value.minutes === 0)) return
  emit('save', {
    ...props.entry,
    languageId: form.value.languageId,
    type: form.value.type,
    hours: form.value.hours,
    minutes: form.value.minutes,
    date: form.value.date,
    notes: form.value.notes || null
  })
}
</script>
