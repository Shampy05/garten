<template>
  <div class="relative inline-flex items-center justify-center" :style="{ width: size + 'px', height: size + 'px' }">
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      class="-rotate-90"
      :aria-label="label"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" :stop-color="startColor" />
          <stop offset="100%" :stop-color="endColor" />
        </linearGradient>
      </defs>
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="trackColor"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="`url(#${gradientId})`"
        :stroke-width="stroke"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        stroke-linecap="round"
        class="transition-all duration-700 ease-out"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
      <span v-if="showPercent" class="font-display font-bold leading-none" :class="textSize" :style="{ color: startColor }">
        {{ displayPct }}%
      </span>
      <span v-if="showPages && totalPages" class="text-[10px] text-stone-400 mt-0.5 font-medium tabular-nums">
        {{ currentPage }}/{{ totalPages }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentPage: { type: Number, default: 0 },
  totalPages: { type: Number, default: 0 },
  size: { type: Number, default: 72 },
  stroke: { type: Number, default: 5 },
  startColor: { type: String, default: '#16a34a' }, // garden-600
  endColor: { type: String, default: '#15803d' },   // garden-700
  trackColor: { type: String, default: '#e7e5e4' }, // stone-200
  showPercent: { type: Boolean, default: true },
  showPages: { type: Boolean, default: true },
})

const radius = computed(() => props.size / 2 - props.stroke / 2 - 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const pct = computed(() => {
  if (!props.totalPages || props.totalPages <= 0) return 0
  return Math.min(100, Math.max(0, (props.currentPage / props.totalPages) * 100))
})
const displayPct = computed(() => Math.round(pct.value))
const dashOffset = computed(() => circumference.value * (1 - pct.value / 100))
const gradientId = computed(() => `progress-ring-gradient-${Math.random().toString(36).slice(2, 9)}`)
const textSize = computed(() => {
  if (props.size >= 96) return 'text-xl'
  if (props.size >= 72) return 'text-base'
  return 'text-xs'
})
const label = computed(() => `${displayPct.value}% read, page ${props.currentPage} of ${props.totalPages}`)
</script>
