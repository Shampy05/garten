<template>
  <g @mouseenter="emit('hover', $event)" @mouseleave="emit('leave')" style="cursor: help">
    <!-- The tooltip itself is rendered by GardenScene.vue as an HTML overlay
         (Teleport to body). The SVG <text> path couldn't handle RTL script
         (Arabic/Urdu rendered with missing characters), so we let the
         browser's normal text pipeline render it. -->

    <g :transform="plantTransform">
    <!-- Soft ground shadow — a flat dark ellipse anchored at the stem
         base, painted before the soil mound so the mound's lighter centre
         eats the middle and the shadow reads as a rim. Attribute-only. -->
    <ellipse :cx="x" :cy="groundY + 6" rx="22" ry="3.5" fill="#000000" opacity="0.07" />
    <!-- soil mound — every stage has a small dark mound at the base -->
    <ellipse :cx="x" :cy="groundY + 4" rx="14" ry="3" fill="#d8cfbc" />
    <ellipse :cx="x" :cy="groundY + 2" rx="11" ry="2" fill="#e7e0d2" />

    <!-- Stage-specific silhouette. Stem base is at (x, groundY); positive y
         goes downward, so stem path uses groundY - h. `stemToY` and `flowerY`
         are computed once below. -->
    <g
      :transform="`rotate(${plant.tilt} ${x} ${groundY})`"
      :opacity="plant.droopOpacity"
    >
      <g v-if="plant.stage === 'seedling'">
        <!-- Species-specific seedling: a flower has cotyledons, a bush is a
             tiny mound with a stub, a bell is a hooked sprout, a spike is
             two narrow blades. Makes a row of fresh plantings feel
             varied rather than identical. -->
        <component :is="seedlingSilhouette" />
      </g>

      <g v-else-if="plant.stage === 'sprout'">
        <!-- species-specific 40u silhouette + closed bud -->
        <component :is="sproutSilhouette" />
        <g v-if="speciesBud()">
          <ellipse :cx="x" :cy="stemToY - 2" rx="2.4" ry="3" :fill="budPetal" />
        </g>
      </g>

      <g v-else>
        <component :is="bloomSilhouette" />
      </g>
    </g>
    </g>

    <!-- Beds at the plant's feet (pressed blooms). Established regardless of
         the plant's current size, so they sit outside the grown transform. -->
    <g v-if="bed" :transform="`translate(${x + bed.side * 20}, ${groundY + 3})`">
      <ellipse
        v-for="(p, i) in bed.petals"
        :key="i"
        cx="0"
        :cy="0 - p.reach * 0.6"
        rx="2.4"
        :ry="p.reach * 0.6"
        :transform="`rotate(${(360 / bed.petals.length) * i + p.angleJitter})`"
        :fill="bed.color"
        fill-opacity="0.55"
      />
      <circle cx="0" cy="0" r="1.8" :fill="bed.color" />
    </g>

    <!-- Name label on the grass — what turns a silhouette into "my Spanish".
         Attribute-styled so it survives into the PNG portrait; fixed y (no
         jitter, no scale) so labels sit on one calm baseline. -->
    <text
      :x="x"
      :y="groundY + 20"
      text-anchor="middle"
      font-family="Inter, system-ui, sans-serif"
      font-size="11"
      font-weight="600"
      fill="#3d5244"
      opacity="0.85"
    >{{ plant.label }}</text>
  </g>
</template>

<script setup>
import { computed, h } from 'vue'
import { STAGE_GEOM, SPECIES, PRESENCE } from '../lib/gardenScene.js'
import { BLOOMS } from '../lib/avatar.js'

const props = defineProps({
  plant: { type: Object, required: true },
  groundY: { type: Number, required: true },
  bed: { type: Object, default: null },
})

// Hover events bubble up to GardenScene.vue, which renders a single shared
// HTML tooltip overlay (Teleport to body). The native <title> and a custom
// SVG <text> both mangle RTL script, so we let the browser's normal text
// pipeline render it via HTML.
const emit = defineEmits(['hover', 'leave'])

// Stem-to-y for this plant's stage, before scale (the renderer multiplies the
// silhouette vertically by plant.scale via a parent <g transform>).
const stemToY = computed(() => props.groundY - STAGE_GEOM[props.plant.stage].height)
const x = computed(() => props.plant.x)
const flowerY = computed(() => stemToY.value - 2)
const topY = computed(() => stemToY.value - 6) // for spike grass blades / flourish branch

// Outer transform on the whole plant: within-stage size × PRESENCE, anchored
// at the stem base (x, groundY) — a bare scale() would be anchored at the
// SVG origin and lift every sub-1.0 plant off the ground. Droop rotates about
// the same base point, so the two compose cleanly.
const plantTransform = computed(() => {
  const s = props.plant.scale * PRESENCE
  const gx = x.value
  const gy = props.groundY
  const t = [
    `translate(0 ${props.plant.yJitter || 0})`,
    `translate(${gx} ${gy}) scale(${s}) translate(${-gx} ${-gy})`,
  ]
  if (props.plant.droopTransform) t.push(props.plant.droopTransform)
  // Sway is applied by class on the parent <g> in GardenScene.vue; this plant
  // is the inner group whose transform is the static base pose.
  return t.join(' ')
})

// The bloom-color override: chosen BLOOMS petal/center, or the language
// colour when no bloom variant was set.
const budPetal = computed(() => {
  if (props.plant.bloomColor) return props.plant.bloomColor.petal
  return props.plant.color
})
const budCenter = computed(() => {
  if (props.plant.bloomColor) return props.plant.bloomColor.center
  return darkenHex(props.plant.color, 0.2)
})

function speciesBud() { return true }

// The species-bound "seedling" silhouette — a tiny hint of the species to
// come. Each renders a different shape so a row of fresh plantings doesn't
// look like the same icon repeated. Drawn at the stem base.
const seedlingSilhouette = computed(() => {
  const p = props.plant
  const x = props.plant.x
  const gy = props.groundY
  return () => {
    const leafSide = p.jitter.leafSide
    switch (p.species) {
      case 0: // flower — two cotyledons
        return h('g', null, [
          h('line', { x1: x, y1: gy, x2: x, y2: gy - 6, stroke: p.colors.stem, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
          h('ellipse', { cx: x + 2.6, cy: gy - 5.5, rx: 3, ry: 1.6, transform: `rotate(${-32 * leafSide} ${x + 2.6} ${gy - 5.5})`, fill: p.colors.leaf }),
          h('ellipse', { cx: x - 2.6, cy: gy - 5.5, rx: 3, ry: 1.6, transform: `rotate(${32 * leafSide} ${x - 2.6} ${gy - 5.5})`, fill: p.colors.leaf }),
        ])
      case 1: // bush — low mound with a single nub
        return h('g', null, [
          h('ellipse', { cx: x, cy: gy - 1.5, rx: 6, ry: 1.8, fill: p.colors.leaf }),
          h('ellipse', { cx: x + 2 * leafSide, cy: gy - 4, rx: 2.4, ry: 1.4, transform: `rotate(${-20 * leafSide} ${x + 2 * leafSide} ${gy - 4})`, fill: p.colors.leafHi }),
        ])
      case 2: // bell — a hooked sprout
        return h('g', null, [
          h('path', { d: `M${x} ${gy} q ${3 * leafSide} -3 ${5 * leafSide} -2`, fill: 'none', stroke: p.colors.stem, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
          h('ellipse', { cx: x + 5 * leafSide, cy: gy - 3, rx: 1.6, ry: 1, transform: `rotate(${-25 * leafSide} ${x + 5 * leafSide} ${gy - 3})`, fill: p.colors.leaf }),
        ])
      case 3: // spike — two narrow grass blades
        return h('g', null, [
          h('ellipse', { cx: x - 1.4, cy: gy - 3, rx: 0.6, ry: 4, transform: `rotate(${-12 * leafSide} ${x - 1.4} ${gy - 3})`, fill: p.colors.leaf }),
          h('ellipse', { cx: x + 1.4, cy: gy - 3, rx: 0.6, ry: 4, transform: `rotate(${12 * leafSide} ${x + 1.4} ${gy - 3})`, fill: p.colors.leafHi }),
        ])
    }
    return null
  }
})

// The species-bound "sprout" silhouette — a 40u stem plus a single
// species-specific hint. Drawn in render fns so JSX-style h() keeps things
// tidy.
const sproutSilhouette = computed(() => {
  const p = props.plant
  const leafSide = p.jitter.leafSide
  return () => h('g', null, [
    // main stem with a slight bend toward the leaf side
    h('path', {
      d: `M${x.value} ${props.groundY} Q ${x.value + 4 * leafSide} ${(props.groundY + stemToY.value) / 2} ${x.value} ${stemToY.value}`,
      fill: 'none',
      stroke: p.colors.stem,
      'stroke-width': 2,
      'stroke-linecap': 'round',
    }),
    // base cotyledons
    ...[1, -1].map((side) =>
      h('ellipse', {
        cx: x.value + 4 * side,
        cy: stemToY.value + 4,
        rx: 3.6,
        ry: 1.8,
        transform: `rotate(${-32 * side} ${x.value + 4 * side} ${stemToY.value + 4})`,
        fill: p.colors.leaf,
      })
    ),
    // species-specific hint
    speciesSproutHint(p, x.value, stemToY.value, leafSide),
  ])
})

// The "bloom + flourish" silhouette. Flourish adds a side branch.
const bloomSilhouette = computed(() => {
  const p = props.plant
  return () => {
    const sil = renderBloomSpecies(p, x.value, stemToY.value, flowerY.value, topY.value)
    if (p.stage !== 'flourish') return h('g', null, sil)
    // flourish: add a side branch with a small budlet
    const branchDx = 12 * p.jitter.leafSide
    return h('g', null, [
      ...sil,
      h('path', {
        d: `M${x.value} ${stemToY.value + 14} Q ${x.value + 6 * p.jitter.leafSide} ${stemToY.value + 10} ${x.value + branchDx} ${stemToY.value + 4}`,
        fill: 'none',
        stroke: p.colors.stem,
        'stroke-width': 1.4,
        'stroke-linecap': 'round',
      }),
      h('circle', { cx: x.value + branchDx, cy: stemToY.value + 3, r: 2.4, fill: budPetal.value }),
      h('circle', { cx: x.value + branchDx, cy: stemToY.value + 3, r: 1.1, fill: budCenter.value, opacity: 0.7 }),
    ])
  }
})

// -- species implementations -------------------------------------------------

function speciesSproutHint(p, x, sy, leafSide) {
  switch (p.species) {
    case 0: { // upright flower — second leaf pair
      return h('ellipse', {
        cx: x + 5 * leafSide,
        cy: sy + 8,
        rx: 3.4,
        ry: 1.6,
        transform: `rotate(${-40 * leafSide} ${x + 5 * leafSide} ${sy + 8})`,
        fill: p.colors.leafHi,
      })
    }
    case 1: { // bush — small fork stub
      return h('path', {
        d: `M${x} ${sy} l ${4 * leafSide} -6`,
        stroke: p.colors.stem,
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
      })
    }
    case 2: { // bell — hook stub
      return h('path', {
        d: `M${x} ${sy} q 0 -4 ${4 * leafSide} -2`,
        fill: 'none',
        stroke: p.colors.stem,
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
      })
    }
    case 3: { // spike — two narrow blades
      return [
        h('ellipse', { cx: x - 4, cy: sy + 2, rx: 0.8, ry: 5, transform: `rotate(${-15 * leafSide} ${x - 4} ${sy + 2})`, fill: p.colors.leaf }),
        h('ellipse', { cx: x + 4, cy: sy + 2, rx: 0.8, ry: 5, transform: `rotate(${15 * leafSide} ${x + 4} ${sy + 2})`, fill: p.colors.leaf }),
      ]
    }
  }
  return null
}

function renderBloomSpecies(p, x, sy, fy, ty) {
  switch (p.species) {
    case 0: return bloomUpright(p, x, sy, fy)
    case 1: return bloomBush(p, x, sy, fy)
    case 2: return bloomBell(p, x, sy, fy)
    case 3: return bloomSpike(p, x, sy, fy)
  }
  return []
}

function bloomUpright(p, x, sy, fy) {
  const petalCount = p.jitter.petalCount
  const reach = 9 * p.jitter.stretch
  const petals = []
  for (let i = 0; i < petalCount; i++) {
    const angle = (360 / petalCount) * i
    petals.push(h('ellipse', {
      cx: x,
      cy: fy - reach,
      rx: 3.6,
      ry: reach,
      transform: `rotate(${angle} ${x} ${fy})`,
      fill: p.color,
    }))
  }
  // language-color petals first, then chosen-bloom center on top so the
  // personalisation reads as a small accent rather than overriding identity
  const centerEls = [
    h('circle', { cx: x, cy: fy, r: 3.2, fill: budCenter.value }),
  ]
  if (p.bloomColor) {
    centerEls.push(h('circle', { cx: x, cy: fy, r: 1.4, fill: p.bloomColor.center }))
  }
  return [
    h('path', {
      d: `M${x} ${sy + 6} L${x} ${fy}`,
      stroke: p.colors.stem,
      'stroke-width': 2,
      'stroke-linecap': 'round',
    }),
    // alternating leaves
    h('ellipse', { cx: x + 5 * p.jitter.leafSide, cy: sy + 14, rx: 4.2, ry: 2, transform: `rotate(${-38 * p.jitter.leafSide} ${x + 5 * p.jitter.leafSide} ${sy + 14})`, fill: p.colors.leaf }),
    h('ellipse', { cx: x - 4 * p.jitter.leafSide, cy: sy + 22, rx: 3.6, ry: 1.7, transform: `rotate(${36 * p.jitter.leafSide} ${x - 4 * p.jitter.leafSide} ${sy + 22})`, fill: p.colors.leafHi }),
    ...petals,
    ...centerEls,
  ]
}

function bloomBush(p, x, sy, fy) {
  // short trunk forking into 3 arcs with leaf clusters
  const arcs = []
  for (let i = 0; i < 3; i++) {
    const angle = -60 + i * 60
    const tipX = x + Math.sin((angle * Math.PI) / 180) * 16
    const tipY = sy - 6 - Math.cos((angle * Math.PI) / 180) * 16
    arcs.push(h('path', {
      d: `M${x} ${sy} Q ${x + Math.sin((angle * Math.PI) / 180) * 6} ${sy - 6} ${tipX} ${tipY}`,
      stroke: p.colors.stem,
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      fill: 'none',
    }))
    // leaf cluster: 3 small ellipses
    for (let j = 0; j < 3; j++) {
      const ang = angle - 30 + j * 30
      const dx = tipX + Math.sin((ang * Math.PI) / 180) * 3
      const dy = tipY - Math.cos((ang * Math.PI) / 180) * 3
      arcs.push(h('ellipse', {
        cx: dx,
        cy: dy,
        rx: 4,
        ry: 2,
        transform: `rotate(${ang} ${dx} ${dy})`,
        fill: p.colors.leaf,
      }))
    }
  }
  // small petal dots scattered through canopy
  const dots = []
  for (let i = 0; i < 5; i++) {
    const angle = (i * 67) % 360
    const r = 10 + (i % 3) * 3
    const px = x + Math.sin((angle * Math.PI) / 180) * r
    const py = sy - 4 - Math.cos((angle * Math.PI) / 180) * r * 0.6
    dots.push(h('circle', { cx: px, cy: py, r: 1.6, fill: p.color }))
  }
  if (p.bloomColor) {
    dots.push(h('circle', { cx: x, cy: sy - 6, r: 1.2, fill: p.bloomColor.center }))
  }
  return [...arcs, ...dots]
}

function bloomBell(p, x, sy, fy) {
  // hooked top — quadratic curve ending downward
  const hookX = x + 14 * p.jitter.leafSide
  const hookY = sy - 10
  const bellY = sy - 4
  const bells = []
  for (let i = 0; i < 3; i++) {
    const by = bellY - i * 6
    bells.push(h('ellipse', {
      cx: hookX,
      cy: by,
      rx: 3.4,
      ry: 4.4,
      fill: p.color,
    }))
    bells.push(h('ellipse', {
      cx: hookX,
      cy: by + 1.5,
      rx: 1.4,
      ry: 1.4,
      fill: budCenter.value,
      opacity: 0.6,
    }))
  }
  return [
    // tall stem
    h('path', {
      d: `M${x} ${sy + 6} Q ${x + 4 * p.jitter.leafSide} ${(sy + 6 + sy - 14) / 2} ${x} ${sy - 14}`,
      stroke: p.colors.stem,
      'stroke-width': 1.8,
      'stroke-linecap': 'round',
      fill: 'none',
    }),
    // the hook
    h('path', {
      d: `M${x} ${sy - 14} Q ${hookX} ${sy - 18} ${hookX} ${hookY}`,
      stroke: p.colors.stem,
      'stroke-width': 1.8,
      'stroke-linecap': 'round',
      fill: 'none',
    }),
    // narrow leaves along the stem
    h('ellipse', { cx: x + 4 * p.jitter.leafSide, cy: sy + 0, rx: 3.4, ry: 1.4, transform: `rotate(${-30 * p.jitter.leafSide} ${x + 4 * p.jitter.leafSide} ${sy + 0})`, fill: p.colors.leaf }),
    h('ellipse', { cx: x - 3 * p.jitter.leafSide, cy: sy - 8, rx: 3, ry: 1.3, transform: `rotate(${28 * p.jitter.leafSide} ${x - 3 * p.jitter.leafSide} ${sy - 8})`, fill: p.colors.leafHi }),
    ...bells,
  ]
}

function bloomSpike(p, x, sy, fy) {
  // straight stem + grass blades at base + flower spike up the top third
  const elems = []
  // grass blades
  for (let i = 0; i < 5; i++) {
    const dx = x - 8 + i * 4
    const ang = (i - 2) * 12 * p.jitter.leafSide
    elems.push(h('ellipse', {
      cx: dx,
      cy: sy + 4,
      rx: 0.7,
      ry: 7,
      transform: `rotate(${ang} ${dx} ${sy + 4})`,
      fill: p.colors.leaf,
    }))
  }
  // stem
  elems.push(h('path', {
    d: `M${x} ${sy + 6} L${x} ${fy - 16}`,
    stroke: p.colors.stem,
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    fill: 'none',
  }))
  // spike: stacked small ellipses
  const spikeCount = 8
  for (let i = 0; i < spikeCount; i++) {
    const t = i / (spikeCount - 1)
    const ey = fy - 16 + t * 14
    const rx = 2.6 * (1 - t * 0.4)
    elems.push(h('ellipse', {
      cx: x,
      cy: ey,
      rx,
      ry: 1.6,
      fill: p.color,
      opacity: 0.85 + t * 0.15,
    }))
  }
  if (p.bloomColor) {
    elems.push(h('circle', { cx: x, cy: fy - 16, r: 1.4, fill: p.bloomColor.center }))
  }
  return elems
}

// -- utils -------------------------------------------------------------------

function darkenHex(hex, amt) {
  const h = hex.startsWith('#') ? hex : '#888888'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  const m = (v) => Math.max(0, Math.round(v * (1 - amt)))
  const toHex = (v) => v.toString(16).padStart(2, '0')
  return `#${toHex(m(r))}${toHex(m(g))}${toHex(m(b))}`
}
</script>
