<template>
  <div class="p-4 rounded-xl border transition-colors" :class="cardClasses">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          :style="{ backgroundColor: commitment.language_color }"
        >
          <span class="text-white text-xs font-bold">{{ commitment.ownerName[0].toUpperCase() }}</span>
        </div>
        <div class="min-w-0">
          <span class="text-sm font-medium text-stone-700 truncate block">
            {{ commitment.ownerName }}
          </span>
          <div class="text-xs text-stone-500">
            {{ commitment.language_name }} · {{ fmtHours(commitment.target_minutes) }} this week
          </div>
        </div>
      </div>
      <div v-if="commitment.isSelf" class="flex items-center gap-1 flex-shrink-0">
        <button
          @click="$emit('edit', commitment)"
          class="p-1.5 text-stone-300 hover:text-stone-600 rounded-lg transition-colors"
          title="Edit commitment"
        >
          <Pencil :size="14" />
        </button>
        <button
          @click="$emit('delete', commitment)"
          class="p-1.5 text-stone-300 hover:text-red-500 rounded-lg transition-colors"
          title="Remove commitment"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between text-xs mb-1.5">
        <Flower2 v-if="percent >= 100" :size="13" class="text-garden-500 animate-grow-in" />
        <span v-else></span>
        <span class="text-stone-500 tabular-nums">
          {{ fmtHours(commitment.logged_minutes) }} / {{ fmtHours(commitment.target_minutes) }}
        </span>
      </div>
      <div class="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          class="h-2 rounded-full transition-all duration-500"
          :style="{ width: Math.min(100, percent) + '%', backgroundColor: commitment.language_color }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { X, Pencil, Flower2 } from 'lucide-vue-next'

const props = defineProps({
  commitment: { type: Object, required: true }
})

defineEmits(['edit', 'delete'])

const percent = computed(() => {
  const t = props.commitment.target_minutes || 1
  return Math.round((props.commitment.logged_minutes / t) * 100)
})

const cardClasses = computed(() => {
  if (props.commitment.isSelf) return 'bg-garden-50/30 border-garden-100/60'
  if (percent.value >= 100) return 'bg-garden-50/40 border-garden-100'
  return 'bg-white border-stone-100 hover:border-stone-200'
})

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
