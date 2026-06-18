<template>
  <div class="p-4 rounded-xl border transition-colors" :class="cardClasses">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- Two overlapping avatars: you + your buddy, growing as a pair. -->
        <div class="flex -space-x-2 flex-shrink-0">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white"
            :style="{ backgroundColor: pact.language_color }"
          >
            {{ youInitial }}
          </div>
          <div class="w-8 h-8 rounded-full bg-garden-100 text-garden-700 flex items-center justify-center text-xs font-bold ring-2 ring-white">
            {{ pact.buddy_name[0].toUpperCase() }}
          </div>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-medium text-stone-700 truncate">You &amp; {{ pact.buddy_name }}</span>
            <span
              v-if="pact.joint_streak > 0"
              class="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 flex-shrink-0"
              :title="`${pact.joint_streak}-week joint streak`"
            >
              <Flame :size="12" /> {{ pact.joint_streak }}w
            </span>
          </div>
          <div class="text-xs text-stone-500 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: pact.language_color }"></span>
            {{ pact.language_name }} · {{ fmtHours(pact.target_minutes) }} together this week
          </div>
        </div>
      </div>
      <button
        @click="$emit('end', pact)"
        class="p-1.5 text-stone-300 hover:text-red-500 rounded-lg transition-colors flex-shrink-0"
        title="End pact"
      >
        <X :size="14" />
      </button>
    </div>

    <div class="mb-3">
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span class="font-medium inline-flex items-center gap-1" :class="statusColor">
          <Flower2 v-if="percent >= 100" :size="13" class="text-garden-500 animate-grow-in" />
          {{ statusLabel }}
        </span>
        <span class="text-stone-500 tabular-nums">
          {{ fmtHours(pact.combined_minutes) }} / {{ fmtHours(pact.target_minutes) }}
        </span>
      </div>
      <div class="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          class="h-2 rounded-full transition-all duration-500"
          :style="{ width: Math.min(100, percent) + '%', backgroundColor: pact.language_color }"
        ></div>
      </div>
    </div>

    <!-- Who contributed what — the shared stake, made visible. -->
    <div class="flex items-center justify-between text-xs text-stone-500 tabular-nums">
      <span><span class="font-medium text-stone-600">You</span> {{ fmtHours(pact.my_minutes) }}</span>
      <span><span class="font-medium text-stone-600">{{ pact.buddy_name }}</span> {{ fmtHours(pact.buddy_minutes) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { X, Flame, Flower2 } from 'lucide-vue-next'

const props = defineProps({
  pact: { type: Object, required: true }
})

defineEmits(['end'])

const social = inject('social')
const youInitial = computed(() => {
  const p = social.profile?.value
  return (p?.display_name || p?.username || 'Y')[0].toUpperCase()
})

const percent = computed(() => {
  const t = props.pact.target_minutes || 1
  return Math.round((props.pact.combined_minutes / t) * 100)
})

// Garden vocabulary, matching CommitmentCard so the whole circle reads in one voice.
const statusLabel = computed(() => {
  if (percent.value >= 100) return 'In bloom'
  if (percent.value >= 50) return 'Growing'
  if (percent.value > 0) return 'Sprouting'
  return 'Not planted yet'
})

const statusColor = computed(() => {
  if (percent.value >= 100) return 'text-garden-600'
  if (percent.value >= 50) return 'text-amber-600'
  if (percent.value > 0) return 'text-stone-500'
  return 'text-stone-400'
})

const cardClasses = computed(() =>
  percent.value >= 100 ? 'bg-garden-50/40 border-garden-100' : 'bg-white border-stone-100 hover:border-stone-200'
)

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
