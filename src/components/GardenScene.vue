<template>
  <!-- Transparent card body — the SVG's viewBox is 1200×320 (3.75:1) so on
       wider cards the SVG letterboxes the sides to preserve aspect ratio.
       A white card would show that gap as stark white margins; transparent
       lets the page's paper tone (#f6f7f2) blend with the day-sky horizon
       and the night band stays cohesive too. Border + shadow still frame it. -->
  <div class="gp-card overflow-hidden animate-grow-in" style="background-color: transparent">
    <div class="relative">
      <!-- Top-right controls: download portrait + collapse. Quiet until
           hovered so they don't compete with the scene. -->
      <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <button
          @click="downloadPortrait"
          class="gp-icon-btn w-8 h-8 opacity-60 hover:opacity-100"
          title="Download garden portrait"
          aria-label="Download garden portrait"
        >
          <Download :size="14" />
        </button>
        <button
          @click="$emit('collapse')"
          class="gp-icon-btn w-8 h-8 opacity-60 hover:opacity-100"
          title="Hide garden scene"
          aria-label="Hide garden scene"
        >
          <ChevronUp :size="14" />
        </button>
      </div>
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${scene.viewBox.w} ${scene.viewBox.h}`"
        preserveAspectRatio="xMidYMax meet"
        class="w-full h-auto block"
        style="aspect-ratio: 1200 / 320"
        :class="{ 'gs-live': !staticMode }"
        role="img"
        aria-label="Your garden"
      >
        <defs>
          <linearGradient :id="skyId" x1="0" y1="0" x2="0" y2="1">
            <stop
              v-for="(s, i) in scene.sky.stops"
              :key="i"
              :offset="s.offset"
              :stop-color="s.color"
            />
          </linearGradient>
          <radialGradient :id="glowId" cx="50%" cy="60%" r="60%">
            <stop offset="0%" stop-color="#f2d98a" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#f2d98a" stop-opacity="0" />
          </radialGradient>
          <mask v-if="scene.celestial && scene.celestial.kind === 'moon'" :id="moonId">
            <rect x="0" y="0" :width="scene.viewBox.w" :height="scene.viewBox.h" fill="black" />
            <circle :cx="scene.celestial.x" :cy="scene.celestial.y" :r="scene.celestial.r" fill="white" />
            <circle :cx="scene.celestial.x + 8" :cy="scene.celestial.y - 4" :r="scene.celestial.r * 0.85" fill="black" />
          </mask>
        </defs>

        <!-- Sky -->
        <rect x="0" y="0" :width="scene.viewBox.w" :height="scene.groundY" :fill="`url(#${skyId})`" />

        <!-- Sun / moon — the real hour, made legible. The sun wears twelve
             short rays that drift in a slow counter-rotation, the moon stays
             still. Two nested groups: outer carries the static position, inner
             carries the animation class (so the portrait still rasterizes a
             clean static frame). -->
        <g v-if="scene.celestial">
          <template v-if="scene.celestial.kind === 'sun'">
            <circle :cx="scene.celestial.x" :cy="scene.celestial.y" :r="scene.celestial.r * 1.9" fill="#f4da8c" opacity="0.18" />
            <g :transform="`translate(${scene.celestial.x} ${scene.celestial.y})`">
              <g class="gs-sun-rays">
                <line
                  v-for="i in 12"
                  :key="i"
                  :x1="0"
                  :y1="-(scene.celestial.r * 1.45)"
                  :x2="0"
                  :y2="-(scene.celestial.r * 1.85)"
                  stroke="#f4da8c"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  opacity="0.55"
                  :transform="`rotate(${i * 30})`"
                />
              </g>
            </g>
            <circle :cx="scene.celestial.x" :cy="scene.celestial.y" :r="scene.celestial.r" fill="#f4da8c" opacity="0.9" />
          </template>
          <circle
            v-else
            :cx="scene.celestial.x"
            :cy="scene.celestial.y"
            :r="scene.celestial.r"
            fill="#e6eaf2"
            opacity="0.9"
            :mask="`url(#${moonId})`"
          />
        </g>

        <!-- Clouds — hashed positions, slow drift -->
        <g
          v-for="(c, i) in scene.clouds"
          :key="`cloud-${i}`"
          :transform="`translate(${c.x} ${c.y}) scale(${c.scale})`"
        >
          <g class="gs-cloud" :style="{ animationDuration: c.duration + 's', animationDelay: '-' + c.delay + 's' }">
            <ellipse cx="0" cy="0" rx="34" ry="10" fill="#ffffff" :fill-opacity="c.opacity" />
            <ellipse cx="-20" cy="4" rx="20" ry="7" fill="#ffffff" :fill-opacity="c.opacity" />
            <ellipse cx="20" cy="4" rx="22" ry="8" fill="#ffffff" :fill-opacity="c.opacity" />
          </g>
        </g>

        <!-- Streak glow (day/dawn/dusk only) -->
        <ellipse
          v-if="scene.sky.glow"
          :cx="scene.viewBox.w / 2"
          :cy="scene.groundY - 30"
          :rx="scene.viewBox.w * 0.5"
          :ry="120"
          :fill="`url(#${glowId})`"
        />

        <!-- Rolling background hills — depth behind the planting row -->
        <path :d="hillFarPath" :fill="lightenColor(scene.season.grassTint, 0.25)" opacity="0.8" />
        <path :d="hillNearPath" :fill="darkenColor(scene.season.grassTint, 0.06)" opacity="0.55" />

        <!-- Ground: grass band with an undulating top edge + darker footer -->
        <rect x="0" :y="scene.groundY" :width="scene.viewBox.w" :height="scene.viewBox.h - scene.groundY" :fill="scene.season.grassTint" />
        <path
          :d="groundTopPath"
          :fill="darkenColor(scene.season.grassTint, 0.18)"
          opacity="0.7"
        />
        <rect
          x="0"
          :y="scene.viewBox.h - 10"
          :width="scene.viewBox.w"
          height="10"
          :fill="darkenColor(scene.season.grassTint, 0.15)"
          opacity="0.6"
        />

        <!-- Grass tufts — hashed, deterministic ground texture -->
        <path
          v-for="(t, i) in scene.tufts"
          :key="`tuft-${i}`"
          :d="tuftPath(t)"
          :stroke="darkenColor(scene.season.grassTint, 0.28)"
          stroke-width="1.1"
          stroke-linecap="round"
          fill="none"
          opacity="0.75"
        />
        <!-- Stepping stones — small flat ellipses, one per waypoint.
             The dashed connecting line was removed: the stones alone read
             as a path, the dashes looked like a road. -->
        <g v-if="scene.steppingStones">
          <ellipse
            v-for="(s, i) in scene.steppingStones"
            :key="`stone-${i}`"
            :cx="s.x"
            :cy="scene.groundY + s.y"
            :rx="s.rx"
            :ry="s.ry"
            :transform="`rotate(${s.tilt} ${s.x} ${scene.groundY + s.y})`"
            fill="#c4b8a4"
            stroke="#a89880"
            stroke-width="0.8"
            opacity="0.85"
          />
          <!-- darker rim shadow on the bottom edge for a touch of depth -->
          <ellipse
            v-for="(s, i) in scene.steppingStones"
            :key="`stone-shadow-${i}`"
            :cx="s.x"
            :cy="scene.groundY + s.y + 1.5"
            :rx="s.rx * 0.9"
            :ry="s.ry * 0.5"
            fill="#000000"
            opacity="0.06"
          />
        </g>
        <!-- Winter frost line -->
        <path
          v-if="scene.season.frost"
          :d="frostPath"
          stroke="#eef4f8"
          stroke-width="1.5"
          fill="none"
          opacity="0.7"
        />

        <!-- Plants. No sway — the user found the oscillation distracting. -->
        <g v-for="(plant, i) in scene.plants" :key="plant.id">
          <GardenPlant
            :plant="plant"
            :ground-y="scene.groundY"
            :bed="bedsFor(plant.id)[0] || null"
            @hover="onPlantHover(plant, $event)"
            @leave="onPlantLeave"
          />
        </g>

        <!-- Beds for plants without a bed (if pressed has no matching plant — shouldn't happen) -->
        <g v-for="bed in orphanBeds" :key="`orphan-${bed.id}`" :transform="`translate(${orphanBedX(bed)}, ${scene.groundY + 1})`">
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

        <!-- Sign -->
        <g v-if="scene.sign" :transform="`translate(${scene.sign.x}, ${scene.groundY - 50})`">
          <!-- post -->
          <rect x="-2" y="14" width="4" height="38" fill="#8a6a4a" />
          <!-- board -->
          <rect x="-32" y="0" width="64" height="20" rx="3" fill="#a98a68" stroke="#7a5a3e" stroke-width="1" />
          <text
            x="0"
            y="14"
            text-anchor="middle"
            font-family="Inter, system-ui, sans-serif"
            font-size="11"
            font-weight="600"
            fill="#f6f0e6"
          >{{ scene.sign.text }}</text>
        </g>

        <!-- Companion: bee follows a per-scene offset-path through specific
             flowers; other companions use the base transform + figure-of-eight
             / ground wander. The offset-path lives in scene.beePath.d; the bee
             is a child of the path via the .gs-bee-fly class. -->
        <g v-if="scene.companion && scene.companion.kind === 'bee' && scene.beePath" :style="beeStyle">
          <g class="gs-bee-fly">
            <g class="gs-bob">
              <CompanionGlyph kind="bee" :size="34" />
            </g>
          </g>
        </g>
        <g v-else-if="scene.companion" :transform="companionBaseTransform">
          <g :class="companionAnimClass">
            <g :class="scene.companion.pathKind === 'air' ? 'gs-bob' : ''">
              <CompanionGlyph :kind="scene.companion.kind" :size="34" />
            </g>
          </g>
        </g>

        <!-- Fireflies (night + streak>=3) -->
        <g v-if="scene.fireflies.length > 0">
          <circle
            v-for="(f, i) in scene.fireflies"
            :key="i"
            :cx="f.x"
            :cy="f.y"
            r="1.6"
            fill="#f2d98a"
            opacity="0.6"
            class="gs-firefly"
            :style="{ animationDelay: f.delay + 's' }"
          />
        </g>

        <!-- Seasonal drift particles (spring blossom / autumn leaves) -->
        <g v-if="scene.season.particles.length > 0">
          <template v-for="(p, i) in scene.season.particles" :key="`p-${i}`">
            <circle
              v-if="p.kind === 'blossom'"
              :cx="p.x"
              :cy="p.y"
              :r="p.size"
              fill="#f4dbe3"
              class="gs-drift"
              :style="driftStyle(p)"
            />
            <ellipse
              v-else
              :cx="p.x"
              :cy="p.y"
              :r="p.size"
              :ry="p.size * 0.5"
              :fill="i % 2 === 0 ? '#c98a3e' : '#a87a3a'"
              class="gs-drift"
              :style="driftStyle(p)"
            />
          </template>
        </g>
      </svg>
    </div>

    <!-- HTML tooltip overlay — Teleport to body so RTL script renders with
         the page's normal text pipeline (SVG <text> mangles Urdu/Arabic).
         One shared tooltip tracks the hovered plant, positioned just below
         the cursor and centered horizontally. -->
    <Teleport to="body">
      <div
        v-if="hoveredPlant"
        class="fixed z-50 px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none text-xs font-medium whitespace-nowrap"
        :style="hoveredStyle"
      >{{ hoveredPlant.title }}</div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Download, ChevronUp } from 'lucide-vue-next'
import { buildGardenScene } from '../lib/gardenScene.js'
import { darkenColor, lightenColor } from '../lib/color.js'
import { downloadGardenPortrait } from '../lib/portrait.js'
import { useToast } from '../composables/useToast.js'
import GardenPlant from './GardenPlant.vue'
import CompanionGlyph from './CompanionGlyph.vue'

const props = defineProps({
  languages: { type: Array, default: () => [] },
  entries: { type: Array, default: () => [] },
  streak: { type: Number, default: 0 },
  bloomVariant: { type: Number, default: null },
  companion: { type: Number, default: null },
  gardenName: { type: String, default: '' },
  pressed: { type: Array, default: () => [] },
  // When true, all animations are dropped (used by the PNG portrait clone).
  staticMode: { type: Boolean, default: false },
})

defineEmits(['collapse'])

// Tick the clock every 10 minutes; the band edges are hour-granularity so
// this is plenty. Re-renders the scene when the band changes.
const nowRef = ref(new Date())
let intervalId = null
onMounted(() => {
  intervalId = setInterval(() => { nowRef.value = new Date() }, 10 * 60 * 1000)
})
onBeforeUnmount(() => {
  if (intervalId != null) clearInterval(intervalId)
})

const scene = computed(() => buildGardenScene({
  languages: props.languages,
  entries: props.entries,
  now: nowRef.value,
  streak: props.streak,
  bloomVariant: props.bloomVariant,
  companion: props.companion,
  gardenName: props.gardenName,
  pressed: props.pressed,
}))

const skyId = computed(() => `gs-sky-${Math.random().toString(36).slice(2, 8)}`)
const glowId = computed(() => `gs-glow-${Math.random().toString(36).slice(2, 8)}`)
const moonId = computed(() => `gs-moon-${Math.random().toString(36).slice(2, 8)}`)

// -- ground paths ------------------------------------------------------------

const groundTopPath = computed(() => {
  const w = scene.value.viewBox.w
  const gy = scene.value.groundY
  // Gentle undulation — fixed control points so the ground is the stage,
  // not a hashed actor.
  return `M0 ${gy} Q ${w * 0.2} ${gy - 6} ${w * 0.45} ${gy - 1} T ${w * 0.75} ${gy - 4} Q ${w * 0.9} ${gy - 6} ${w} ${gy - 1} L ${w} ${gy + 8} L 0 ${gy + 8} Z`
})

// Two overlapping background hills just above the horizon — fixed control
// points (the ground is the stage, the plants are the actors), season-tinted.
const hillFarPath = computed(() => {
  const w = scene.value.viewBox.w
  const gy = scene.value.groundY
  return `M0 ${gy} C ${w * 0.12} ${gy - 30} ${w * 0.3} ${gy - 36} ${w * 0.48} ${gy - 12} S ${w * 0.8} ${gy - 30} ${w} ${gy - 8} L ${w} ${gy} Z`
})

const hillNearPath = computed(() => {
  const w = scene.value.viewBox.w
  const gy = scene.value.groundY
  return `M0 ${gy} C ${w * 0.2} ${gy - 12} ${w * 0.42} ${gy - 26} ${w * 0.66} ${gy - 10} S ${w * 0.88} ${gy - 20} ${w} ${gy - 14} L ${w} ${gy} Z`
})

// One tuft = two short leaning blades rooted in the grass band.
function tuftPath(t) {
  const gy = scene.value.groundY
  const x = t.x
  const y = gy + t.y
  const l = t.len
  const lean = t.lean
  return `M${x} ${y} q ${lean} ${-l * 0.7} ${lean * 1.6} ${-l} M${x + 2.5} ${y} q ${-lean * 0.5} ${-l * 0.6} ${-lean * 1.2} ${-l * 0.85}`
}

const frostPath = computed(() => {
  const w = scene.value.viewBox.w
  const gy = scene.value.groundY
  return `M0 ${gy - 1} Q ${w * 0.25} ${gy - 3} ${w * 0.5} ${gy - 1} T ${w} ${gy - 2}`
})

// -- sway / drift styles -----------------------------------------------------

function driftStyle(p) {
  return {
    animationDuration: `${p.duration}s`,
    animationDelay: `${p.delay}s`,
  }
}

// -- companion positioning + animation class --------------------------------

const companionBaseTransform = computed(() => {
  const c = scene.value.companion
  if (!c) return ''
  const w = scene.value.viewBox.w
  const gy = scene.value.groundY
  if (c.pathKind === 'ground') {
    // Start at left side, feet on the grass. The wander keyframe animates
    // translateX across the band with pauses and a turnaround flip.
    return `translate(${w * 0.15} ${gy - 18})`
  }
  // Air (butterfly) — start at upper-left, the wander keyframe loops lazily.
  return `translate(${w * 0.1} ${gy - 100})`
})

const companionAnimClass = computed(() => {
  const c = scene.value.companion
  if (!c) return ''
  if (c.pathKind === 'ground') {
    return c.kind === 'snail' ? 'gs-wander-ground gs-wander-slow' : 'gs-wander-ground'
  }
  return 'gs-wander-air'
})

// The bee's flight path is fed in via CSS custom property so the same
// `gs-bee-fly` keyframe works for any scene. offset-rotate is locked at 0deg
// so the bee stays upright; the path's arcs handle the visual direction.
const beeStyle = computed(() => {
  const bp = scene.value.beePath
  if (!bp) return {}
  return {
    '--bee-path': `path('${bp.d}')`,
    '--bee-duration': `${bp.duration}s`,
  }
})

// -- bed routing -------------------------------------------------------------

function bedsFor(plantId) {
  // Pressed flowers are 1:1 with their language id; the bed is at the
  // plant's own feet. Guard against the impossible orphan (pressed language
  // was deleted) by routing any unmatched beds to the orphan list.
  return (scene.value.beds || []).filter((b) => b.id === plantId)
}

const orphanBeds = computed(() => {
  const plantIds = new Set(scene.value.plants.map((p) => p.id))
  return (scene.value.beds || []).filter((b) => !plantIds.has(b.id))
})

function orphanBedX(bed) {
  // Spread any orphan bed along the band deterministically.
  const h = bed.id ? bed.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 0
  return 200 + (h % 800)
}

// -- refs --------------------------------------------------------------------

const svgEl = ref(null)
defineExpose({ svgEl })

// -- HTML tooltip overlay ----------------------------------------------------
// One shared tooltip, rendered as a fixed-positioned <div> Teleported to
// body. The SVG <text> path mangles RTL script (Arabic/Urdu lose characters),
// so we let the browser's normal HTML text pipeline render it. The tooltip
// follows the cursor so the user sees it wherever the plant sits.

const hoveredPlant = ref(null)
const hoveredX = ref(0)
const hoveredY = ref(0)

function onPlantHover(plant, event) {
  hoveredPlant.value = plant
  hoveredX.value = event.clientX
  hoveredY.value = event.clientY
}
function onPlantLeave() {
  hoveredPlant.value = null
}

const hoveredStyle = computed(() => ({
  left: `${hoveredX.value}px`,
  top: `${hoveredY.value + 16}px`,
  transform: 'translateX(-50%)',
  backgroundColor: 'rgba(45, 55, 45, 0.94)',
  color: '#f6f7f2',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  maxWidth: '320px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}))

// -- portrait download --------------------------------------------------------

const toast = useToast()
async function downloadPortrait() {
  if (!svgEl.value) return
  try {
    await downloadGardenPortrait(svgEl.value)
  } catch (err) {
    toast.error('Portrait failed to grow — try again.')
  }
}
</script>
