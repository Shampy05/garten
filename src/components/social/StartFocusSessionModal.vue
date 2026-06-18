<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="gp-card gp-pad w-full max-w-sm animate-fade-up">
        <div class="flex items-center justify-between mb-4">
          <h3 class="gp-title text-lg">Start focus session</h3>
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
            <label class="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Duration</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="d in durations"
                :key="d"
                @click="duration = d"
                class="px-3 py-1.5 rounded-lg text-sm border transition-all"
                :class="duration === d
                  ? 'border-garden-400 bg-garden-50 text-garden-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'"
              >
                {{ d }} min
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Activity</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in activityTypes"
                :key="t"
                @click="activityType = t"
                class="px-3 py-1.5 rounded-lg text-sm border capitalize transition-all"
                :class="activityType === t
                  ? 'border-garden-400 bg-garden-50 text-garden-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'"
              >
                {{ t }}
              </button>
            </div>
          </div>

          <button
            @click="start"
            :disabled="!selectedLang"
            class="gp-btn-primary w-full py-2.5 text-sm"
          >
            Start {{ duration }}-minute session
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { ACTIVITY_TYPES } from '../../lib/types.js'

const props = defineProps({
  visible: { type: Boolean, required: true },
  languages: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'start'])

const selectedLang = ref(props.languages[0] || null)
const duration = ref(25)
const activityType = ref('vocabulary')
const durations = [15, 25, 45, 60]
const activityTypes = ACTIVITY_TYPES

// Languages can finish loading after this modal mounts (or be passed in late),
// so default the selection whenever the modal opens and nothing is chosen yet.
watch(
  () => props.visible,
  (open) => {
    if (open && !selectedLang.value) selectedLang.value = props.languages[0] || null
  }
)

function start() {
  if (!selectedLang.value) return
  emit('start', {
    language: selectedLang.value,
    durationMinutes: duration.value,
    activityType: activityType.value
  })
  selectedLang.value = props.languages[0] || null
  duration.value = 25
  activityType.value = 'vocabulary'
}
</script>
