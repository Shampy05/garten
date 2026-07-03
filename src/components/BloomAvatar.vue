<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    role="img"
    :aria-label="ariaLabel"
    class="flex-shrink-0"
  >
    <!-- pot: soft garden circle with a hairline ring -->
    <circle cx="24" cy="24" r="23.25" fill="#f0f8f1" stroke="#dcefde" stroke-width="1.5" />
    <!-- soil -->
    <ellipse cx="24" cy="39.5" rx="7.5" ry="2" fill="#e7e0d2" />

    <g :transform="`rotate(${params.tilt} 24 38)`">
      <!-- stem, gently bent toward the leaf side -->
      <path
        :d="`M24 39 Q ${24 + 2 * params.leafSide} ${(39 + stemTop) / 2} 24 ${stemTop}`"
        fill="none"
        stroke="#287a41"
        stroke-width="2"
        stroke-linecap="round"
      />

      <!-- cotyledon pair — every stage keeps its first leaves -->
      <ellipse
        v-for="side in [1, -1]"
        :key="'base' + side"
        :cx="24 + 3.6 * side"
        :cy="leafBaseY - 1.2"
        rx="4.2"
        ry="2.1"
        :transform="`rotate(${-35 * side} ${24 + 3.6 * side} ${leafBaseY - 1.2})`"
        fill="#389150"
      />

      <!-- a higher leaf once the plant is past seedling -->
      <ellipse
        v-if="stage !== 'seedling'"
        :cx="24 + 4 * params.leafSide"
        :cy="stemTop + 6"
        rx="3.8"
        ry="1.9"
        :transform="`rotate(${-38 * params.leafSide} ${24 + 4 * params.leafSide} ${stemTop + 6})`"
        fill="#5cae6b"
      />

      <!-- sprout: a closed bud in the gardener's bloom colour -->
      <g v-if="stage === 'sprout'">
        <ellipse :cx="24" :cy="stemTop - 2.5" rx="2.8" ry="3.6" :fill="params.bloom.petal" />
        <ellipse :cx="24" :cy="stemTop - 1.5" rx="1.5" ry="2" :fill="params.bloom.center" opacity="0.55" />
      </g>

      <!-- bloom / flourish: open flower -->
      <g v-else-if="stage === 'bloom' || stage === 'flourish'">
        <ellipse
          v-for="angle in petalAngles"
          :key="angle"
          :cx="24"
          :cy="flowerY - petalReach"
          rx="2.9"
          :ry="petalReach"
          :transform="`rotate(${angle} 24 ${flowerY})`"
          :fill="params.bloom.petal"
        />
        <circle :cx="24" :cy="flowerY" r="2.7" :fill="params.bloom.center" />

        <!-- flourish: a second budlet on a side branch -->
        <g v-if="stage === 'flourish'">
          <path
            :d="`M24 ${stemTop + 9} Q ${24 + 4 * params.leafSide} ${stemTop + 7} ${24 + 7 * params.leafSide} ${stemTop + 4}`"
            fill="none"
            stroke="#287a41"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <circle :cx="24 + 7.5 * params.leafSide" :cy="stemTop + 3.2" r="2.2" :fill="params.bloom.petal" />
          <circle :cx="24 + 7.5 * params.leafSide" :cy="stemTop + 3.2" r="1" :fill="params.bloom.center" opacity="0.7" />
        </g>
      </g>
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { avatarParams, growthStage, BLOOMS } from '../lib/avatar.js'

const props = defineProps({
  // Stable id (user uuid) — the same seed renders the same plant everywhere.
  seed: { type: String, default: '' },
  // Total logged hours; drives the growth stage. null = unknown (friends).
  hours: { type: Number, default: null },
  // Chosen bloom colour (index into BLOOMS); null = keep the hashed default.
  variant: { type: Number, default: null },
  size: { type: Number, default: 36 },
  name: { type: String, default: '' },
})

const params = computed(() => {
  const base = avatarParams(props.seed)
  // A gardener's chosen bloom overrides only the colour — shape (petals, tilt,
  // leaf side) stays hashed from the id so they're still recognisably them.
  if (props.variant != null && BLOOMS[props.variant]) {
    return { ...base, bloom: BLOOMS[props.variant] }
  }
  return base
})
const stage = computed(() => growthStage(props.hours))

// Taller plant at each stage.
const stemTop = computed(
  () => ({ seedling: 30, sprout: 25, bloom: 22, flourish: 21 })[stage.value]
)
const leafBaseY = computed(() => (stage.value === 'seedling' ? 31 : 33))

const flowerY = computed(() => stemTop.value - 3.5)
const petalReach = computed(() => 4.6 * params.value.petalStretch)
const petalAngles = computed(() =>
  Array.from({ length: params.value.petals }, (_, i) => (360 / params.value.petals) * i)
)

const ariaLabel = computed(() =>
  props.name ? `${props.name}'s garden avatar` : `Garden avatar, ${stage.value} stage`
)
</script>
