<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-stone-100/80 border border-line">
        <button
          v-for="mode in modes"
          :key="mode.value"
          @click="$emit('mode-change', mode.value)"
          class="px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
          :class="viewMode === mode.value ? 'bg-white text-garden-700 shadow-pill' : 'text-stone-500 hover:text-stone-700'"
        >
          {{ mode.label }}
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          @click="$emit('navigate', -1)"
          class="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
          title="Previous"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <span class="text-sm font-semibold text-stone-800 text-center select-none tabular-nums min-w-[7rem]">
          {{ dateLabel }}
        </span>
        <button
          @click="$emit('navigate', 1)"
          class="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
          title="Next"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  viewMode: { type: String, required: true },
  viewDate: { type: Date, required: true }
})

defineEmits(['mode-change', 'navigate'])

const modes = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' }
]

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const dateLabel = computed(() => {
  const d = props.viewDate
  switch (props.viewMode) {
    case 'month':
      return `${months[d.getMonth()]} ${d.getFullYear()}`
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3) + 1
      return `Q${q} - ${d.getFullYear()}`
    }
    case 'year':
      return `${d.getFullYear()}`
    default:
      return ''
  }
})
</script>
