<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" role="img" :aria-label="`${name} pressed bloom`">
    <ellipse
      v-for="p in petals"
      :key="p.angle"
      cx="16"
      :cy="16 - p.reach"
      rx="3.2"
      :ry="p.reach"
      :transform="`rotate(${p.angle} 16 16)`"
      :fill="color"
      fill-opacity="0.55"
    />
    <circle cx="16" cy="16" r="2.6" :fill="color" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { hashSeed } from '../lib/avatar.js'

// A small flattened-bloom keepsake for a language that has bloomed. Petals
// are deliberately a touch irregular (pressed flowers aren't symmetric),
// hashed from the language id so the same language always presses the same
// way. Faded fill (55% opacity) gives the "pressed between pages" feel.
const props = defineProps({
  languageId: { type: String, default: '' },
  color: { type: String, default: '#a8a29e' },
  name: { type: String, default: '' },
  size: { type: Number, default: 32 },
})

const petals = computed(() => {
  const h = hashSeed(props.languageId)
  const count = 5 + ((h >>> 2) % 2) // 5 or 6
  return Array.from({ length: count }, (_, i) => {
    const jitter = ((h >>> (4 + i * 2)) % 9) - 4 // -4..4 degrees
    const stretch = 5.4 + (((h >>> (12 + i)) % 3) - 1) * 0.5 // slight length variance
    return { angle: (360 / count) * i + jitter, reach: stretch }
  })
})
</script>
