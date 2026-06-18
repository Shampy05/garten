<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="gp-card gp-pad w-full max-w-sm animate-fade-up">
        <div class="flex items-center justify-between mb-4">
          <h3 class="gp-title text-lg">{{ editing ? 'Edit' : 'Set' }} weekly commitment</h3>
          <button @click="$emit('close')" class="text-stone-400 hover:text-stone-600">
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Language</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="lang in languages"
                :key="lang.id"
                @click="selectedLang = lang"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all"
                :class="selectedLang?.id === lang.id
                  ? 'border-garden-400 bg-garden-50 text-garden-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color }"></span>
                {{ lang.name }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Target this week</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <button
                v-for="preset in presets"
                :key="preset"
                @click="targetMinutes = preset"
                class="px-3 py-1.5 rounded-lg text-sm border transition-all"
                :class="targetMinutes === preset
                  ? 'border-garden-400 bg-garden-50 text-garden-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'"
              >
                {{ fmtHours(preset) }}
              </button>
            </div>
            <input
              v-model.number="targetMinutes"
              type="number"
              min="1"
              step="5"
              class="gp-input"
              placeholder="Minutes"
            />
          </div>

          <button
            @click="save"
            :disabled="!selectedLang || targetMinutes < 1"
            class="gp-btn-primary w-full py-2.5 text-sm"
          >
            Save commitment
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  visible: { type: Boolean, required: true },
  languages: { type: Array, default: () => [] },
  commitment: { type: Object, default: null }
})

const emit = defineEmits(['close', 'save'])

const selectedLang = ref(props.languages[0] || null)
const targetMinutes = ref(60)
const presets = [30, 60, 120, 180]
const editing = computed(() => !!props.commitment)

watch(() => props.commitment, (c) => {
  if (c) {
    selectedLang.value = props.languages.find((l) => l.id === c.language_id) || props.languages[0] || null
    targetMinutes.value = c.target_minutes
  } else {
    selectedLang.value = props.languages[0] || null
    targetMinutes.value = 60
  }
}, { immediate: true })

watch(() => props.visible, (visible) => {
  if (visible) {
    if (props.commitment) {
      selectedLang.value = props.languages.find((l) => l.id === props.commitment.language_id) || props.languages[0] || null
      targetMinutes.value = props.commitment.target_minutes
    } else {
      selectedLang.value = props.languages[0] || null
      targetMinutes.value = 60
    }
  }
})

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

function save() {
  if (!selectedLang.value || targetMinutes.value < 1) return
  emit('save', {
    language: selectedLang.value,
    targetMinutes: targetMinutes.value
  })
}
</script>
