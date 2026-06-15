<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-24 px-4">
      <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" @click="$emit('close')"></div>
      <div class="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md z-10 p-5 space-y-4">
        <h2 class="text-lg font-bold text-gray-900">Edit Session</h2>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Language</label>
          <select v-model="form.languageId"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option v-for="lang in languages" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select v-model="form.type"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 capitalize"
          >
            <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="flex gap-3">
          <div class="flex-1">
            <label class="block text-xs font-medium text-gray-600 mb-1">Hours</label>
            <input v-model.number="form.hours" type="number" min="0" max="24"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div class="flex-1">
            <label class="block text-xs font-medium text-gray-600 mb-1">Minutes</label>
            <input v-model.number="form.minutes" type="number" min="0" max="59"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input v-model="form.date" type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea v-model="form.notes" rows="2" placeholder="What did you study?"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          ></textarea>
        </div>

        <div class="flex gap-2 pt-1">
          <button @click="$emit('close')"
            class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >Cancel</button>
          <button @click="save"
            :disabled="!form.languageId || !form.type || (form.hours === 0 && form.minutes === 0)"
            class="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
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

const { languageFor } = useLanguageLookup(() => props.languages)

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
