<template>
  <div class="gp-card gp-pad">
    <div class="flex items-center justify-between gap-3 mb-4">
      <h3 class="gp-title text-lg">Leaderboard</h3>
      <div class="inline-flex items-center p-0.5 rounded-lg bg-stone-100">
        <button
          v-for="w in windows"
          :key="w.key"
          @click="setWindow(w.key)"
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
          :class="window === w.key
            ? 'bg-white text-stone-800 shadow-sm'
            : 'text-stone-500 hover:text-stone-700'"
        >
          {{ w.label }}
        </button>
      </div>
    </div>

    <div v-if="leaderboard.length === 0" class="text-center py-8 text-stone-400">
      <Trophy :size="28" class="mx-auto mb-2 text-stone-300" />
      <p class="text-sm">No circle activity yet.</p>
      <p class="text-xs mt-1">Add friends to see the leaderboard grow.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="row in visibleRows"
        :key="row.user_id"
        class="rounded-xl border transition-colors"
        :class="rowClasses(row)"
      >
        <!-- Visible summary row. Layout: rank | avatar | name+streak | hours | chevron -->
        <div class="p-3">
          <div class="flex items-center gap-3">
            <!-- Rank badge -->
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              :class="rankClasses(row.rank)"
            >
              {{ row.rank }}
            </div>

            <!-- Avatar — tapping this opens the profile for friends. Pass
                 :variant so the chosen bloom colour from the profile modal
                 shows up here too (without it BloomAvatar falls back to the
                 id-hashed default and the leaderboard flowers look generic). -->
            <button
              v-if="!row.isSelf"
              type="button"
              class="rounded-full flex-shrink-0 hover:ring-2 hover:ring-garden-200 transition-shadow"
              :title="`View ${row.display_name || row.username}'s profile`"
              @click="openProfile(row)"
            >
              <BloomAvatar :seed="row.user_id" :size="36" :name="row.display_name || row.username" :variant="row.avatar_variant" class="block" />
            </button>
            <BloomAvatar v-else :seed="row.user_id" :size="36" :variant="row.avatar_variant" />

            <!-- Name + streak — name also opens profile for friends -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 min-w-0">
                <button
                  v-if="!row.isSelf"
                  type="button"
                  class="text-sm font-medium text-stone-700 hover:text-garden-700 truncate transition-colors text-left"
                  @click="openProfile(row)"
                >
                  {{ row.display_name || row.username }}
                </button>
                <span v-else class="text-sm font-medium text-stone-700 truncate">You</span>
                <span
                  v-if="row.current_streak > 0"
                  class="text-xs font-medium text-orange-500 flex-shrink-0"
                >
                  {{ row.current_streak }}d
                </span>
              </div>
            </div>

            <!-- Hours -->
            <div class="text-right flex-shrink-0">
              <div class="text-sm font-bold text-stone-800 tabular-nums">{{ fmtHours(row.minutes) }}</div>
              <div class="text-[10px] text-stone-400 uppercase tracking-wide">hours</div>
            </div>

            <!-- Expand / collapse chevron — distinct click target from profile -->
            <button
              v-if="hasDetail(row)"
              type="button"
              class="flex-shrink-0 p-0.5 text-stone-300 hover:text-stone-500 transition-colors"
              :title="expanded[row.user_id] ? 'Collapse' : 'Expand language detail'"
              @click="toggle(row)"
            >
              <ChevronDown
                :size="15"
                class="transition-transform duration-200"
                :class="{ 'rotate-180': expanded[row.user_id] }"
              />
            </button>
          </div>

          <!-- Language-mix ribbon — sits below the summary line, full inner width.
               Texture as colour: who's all-in on one language vs spread across many. -->
          <div
            v-if="langs(row).length > 0"
            class="mt-2.5 flex gap-px h-2 rounded-full overflow-hidden bg-stone-100"
          >
            <div
              v-for="l in langs(row)"
              :key="l.name"
              class="h-2"
              :style="{ width: pct(row, l.minutes) + '%', backgroundColor: l.color }"
              :title="`${l.name} · ${fmtHours(l.minutes)}`"
            ></div>
          </div>
        </div>

        <!-- Expanded texture: what they're actually growing. -->
        <div
          v-if="expanded[row.user_id] && hasDetail(row)"
          class="px-3 pb-3 -mt-0.5 space-y-2.5 animate-fade-up"
        >
          <div class="flex flex-wrap gap-x-3 gap-y-1">
            <span
              v-for="l in langs(row)"
              :key="l.name"
              class="inline-flex items-center gap-1.5 text-xs text-stone-500"
            >
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: l.color }"></span>
              <span class="text-stone-600 font-medium">{{ l.name }}</span>
              <span class="tabular-nums">{{ fmtHours(l.minutes) }}</span>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 pt-2 border-t border-line">
            <template v-for="(a, i) in acts(row)" :key="a.type">
              <span>
                <span class="text-stone-600 font-medium capitalize">{{ a.type }}</span>
                <span class="tabular-nums ml-1">{{ fmtHours(a.minutes) }}</span>
              </span>
              <span v-if="i < acts(row).length - 1" class="text-stone-300">·</span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { Trophy, ChevronDown } from 'lucide-vue-next'
import BloomAvatar from '../BloomAvatar.vue'

const emit = defineEmits(['open-profile'])

const social = inject('social')
const { leaderboard, leaderboardWindow, circleBreakdown } = social

const window = leaderboardWindow
const windows = [
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'all_time', label: 'All time' }
]

// Per-row open state (keyed by user_id) so expanding one gardener never
// collapses another — you can compare several side by side.
const expanded = ref({})

function setWindow(w) {
  if (window.value === w) return
  expanded.value = {}
  social.loadLeaderboard(w)
}

function toggle(row) {
  if (!hasDetail(row)) return
  expanded.value[row.user_id] = !expanded.value[row.user_id]
}

// Emit open-profile for non-self rows so the parent can render the profile modal.
function openProfile(row) {
  if (row.isSelf) return
  emit('open-profile', row.user_id)
}

const visibleRows = computed(() => {
  const top = leaderboard.value.slice(0, 5)
  const me = leaderboard.value.find((r) => r.isSelf)
  if (!me || top.some((r) => r.isSelf)) return top
  return [...top, me]
})

// Per-gardener texture, defensively defaulted while the breakdown loads.
function detail(row) {
  return circleBreakdown.value[row.user_id] || null
}
function langs(row) {
  return detail(row)?.languages || []
}
function acts(row) {
  return detail(row)?.activities || []
}
function hasDetail(row) {
  return langs(row).length > 0
}
function pct(row, mins) {
  const total = detail(row)?.total || 0
  if (total <= 0) return 0
  // Floor a hair so a sliver language still paints; widths are visual, not exact.
  return Math.max(2, (mins / total) * 100)
}

// Collaborative, not competitive: every row reads the same, and the only
// highlight is a subtle ring so you can spot yourself.
function rowClasses(row) {
  if (row.isSelf) return 'bg-garden-50/50 border-garden-200 ring-1 ring-garden-100'
  return 'bg-white border-stone-100 hover:border-stone-200'
}

function rankClasses() {
  return 'bg-stone-100 text-stone-500'
}

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
</script>
