<template>
  <div v-if="rows.length > 0" class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
    <div class="flex items-baseline justify-between mb-5">
      <h3 class="font-display text-lg font-semibold text-gray-800">Fluency Horizon</h3>
      <button
        @click="$emit('manage')"
        class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Set starting point
      </button>
    </div>

    <div class="space-y-5">
      <div v-for="row in visibleRows" :key="row.id">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: row.color }"></span>
          <span class="text-sm font-medium text-gray-700 truncate">{{ row.name }}</span>
          <span
            v-if="row.badge"
            class="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full whitespace-nowrap"
          >
            {{ row.badge }}
          </span>
          <span class="text-sm font-semibold ml-auto whitespace-nowrap" :style="{ color: row.color }">
            {{ row.pctLabel }}
          </span>
        </div>

        <!-- Track with CEFR milestone ticks -->
        <div class="relative w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div class="absolute inset-0 flex">
            <div
              v-if="row.priorPct > 0"
              class="h-full transition-all duration-500"
              :style="{ width: row.priorPct + '%', backgroundColor: row.color, opacity: 0.4 }"
            ></div>
            <div
              v-if="row.loggedPct > 0"
              class="h-full transition-all duration-500"
              :style="{ width: row.loggedPct + '%', backgroundColor: row.color }"
            ></div>
          </div>
          <div
            v-for="tick in row.ticks"
            :key="tick.key"
            class="absolute top-0 h-full"
            :class="tick.prof ? 'w-0.5 bg-emerald-500' : 'w-px bg-white/70'"
            :style="{ left: tick.left + '%' }"
            :title="tick.label"
          ></div>
        </div>

        <div class="flex items-center justify-between mt-1.5 gap-2">
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="text-xs whitespace-nowrap" :class="row.reached ? 'text-green-600 font-medium' : 'text-gray-400'">
              {{ row.statusLabel }}
            </span>
            <span
              v-if="row.momentumLabel"
              class="text-[10px] font-medium whitespace-nowrap"
              :class="row.momentumDir === 'up' ? 'text-green-600' : 'text-gray-400'"
              :title="`Pace ${row.momentumDir === 'up' ? 'up' : 'down'} vs the previous 4 weeks`"
            >
              {{ row.momentumLabel }} vs last month
            </span>
          </div>
          <span class="text-[10px] text-gray-300 whitespace-nowrap">
            {{ row.totalHours }} / {{ row.goal }}h
          </span>
        </div>
      </div>
    </div>

    <button
      v-if="dormantRows.length > 0"
      @click="showAll = !showAll"
      class="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
    >
      {{ showAll ? 'Hide untouched languages' : `Show ${dormantRows.length} more not yet started` }}
    </button>

    <p class="text-[10px] text-gray-300 mt-4 leading-relaxed">
      Targets estimate the hours to professional working proficiency (~CEFR B2/C1),
      based on FSI language-difficulty research<template v-if="nativeLanguage">, adjusted
      for how close {{ nativeLanguage }} is to each language</template>. Ticks mark the A2, B1
      and B2 milestones. Past proficiency the horizon extends to a mastery (~C2) target.
      Forecasts weight your recent sessions more heavily and flag whether your pace is
      rising or falling versus the previous month.
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { localDateStr, daysBetween } from '../lib/date.js'
import {
  targetHours,
  masteryHours,
  forecastMonths,
  weightedWeeklyPace,
  paceMomentum,
  PACE_WINDOW_DAYS,
  LEVELS,
} from '../lib/proficiency.js'

const props = defineProps({
  entries: { type: Array, required: true },
  languages: { type: Array, required: true },
  nativeLanguage: { type: String, default: null },
})

defineEmits(['manage'])

// Don't extrapolate a forecast from a trickle, and never print an absurd ETA.
const MIN_PACE_HOURS_PER_WEEK = 0.5
const MAX_FORECAST_MONTHS = 120 // 10 years

const showAll = ref(false)

const CEFR_TICKS = LEVELS.filter((l) => ['a2', 'b1', 'b2'].includes(l.key))

// All-time minutes per language, plus a per-day breakdown over the trailing
// pace window (indexed by days-ago) that feeds the recency-weighted forecast.
const stats = computed(() => {
  const todayStr = localDateStr(new Date())

  const total = {}
  const daily = {} // languageId -> array indexed by days-ago
  for (const e of props.entries) {
    const mins = e.hours * 60 + e.minutes
    total[e.languageId] = (total[e.languageId] || 0) + mins

    const age = daysBetween(e.date, todayStr)
    if (age >= 0 && age < PACE_WINDOW_DAYS) {
      if (!daily[e.languageId]) daily[e.languageId] = new Array(PACE_WINDOW_DAYS).fill(0)
      daily[e.languageId][age] += mins
    }
  }
  return { total, daily }
})

// Minutes logged in the last 28 days, from the per-day buckets.
function recentMinutes(minutesByAge) {
  let sum = 0
  for (let age = 0; age < 28; age++) sum += minutesByAge[age] || 0
  return sum
}

// A bare duration phrase, or null when there's nothing sensible to show.
function fmtForecast(months) {
  if (months == null || months > MAX_FORECAST_MONTHS) return null
  if (months < 1) return 'under a month'
  if (months < 18) return `~${Math.round(months)} months`
  return `~${(months / 12).toFixed(1)} years`
}

const rows = computed(() => {
  return props.languages
    .map((lang) => {
      const base = targetHours(lang.name, props.nativeLanguage)
      const mastery = masteryHours(lang.name, props.nativeLanguage)
      const priorHours = Number(lang.prior_hours) || 0
      const loggedHours = (stats.value.total[lang.id] || 0) / 60
      const totalHours = priorHours + loggedHours

      // Three phases: working toward professional proficiency, then toward a
      // mastery (~C2) stretch target, then maintaining once that's reached.
      const reachedBase = totalHours >= base
      const reachedMastery = totalHours >= mastery
      const phase = reachedMastery ? 'maintaining' : reachedBase ? 'mastery' : 'learning'
      const goal = phase === 'learning' ? base : mastery

      const priorPct = Math.min((priorHours / goal) * 100, 100)
      const loggedPct = Math.min((loggedHours / goal) * 100, 100 - priorPct)
      const pct = Math.min((totalHours / goal) * 100, 100)

      // Milestone ticks, positioned against the active goal. Past proficiency a
      // green "proficiency reached" marker sits where the base target was.
      const scale = base / goal
      const ticks = CEFR_TICKS.map((l) => ({
        key: l.key,
        left: l.fraction * scale * 100,
        label: l.label,
        prof: false,
      }))
      if (phase !== 'learning') {
        ticks.push({ key: 'prof', left: scale * 100, label: 'Professional proficiency (~C1) reached', prof: true })
      }

      const minutesByAge = stats.value.daily[lang.id] || []
      const recentHours = recentMinutes(minutesByAge) / 60
      const weeklyPace = weightedWeeklyPace(minutesByAge)
      const remaining = Math.max(goal - totalHours, 0)

      let statusLabel
      if (phase === 'maintaining') {
        statusLabel = 'Mastery reached — maintaining'
      } else {
        const dest = phase === 'mastery' ? 'to mastery' : 'to go'
        const forecast =
          weeklyPace >= MIN_PACE_HOURS_PER_WEEK
            ? fmtForecast(forecastMonths(remaining, weeklyPace))
            : null
        statusLabel = forecast ? `${forecast} ${dest}` : `${Math.round(remaining)}h ${dest}`
      }

      // Badge acknowledging milestones already cleared.
      const badge = phase === 'maintaining' ? 'Mastery' : phase === 'mastery' ? 'Proficient' : null

      // Momentum vs the previous 4 weeks — only when it's a meaningful swing,
      // and not once a learner is just maintaining.
      let momentumLabel = null
      let momentumDir = null
      if (phase !== 'maintaining') {
        const m = paceMomentum(minutesByAge)
        if (m != null && Math.abs(m) >= 0.1) {
          const mPct = Math.round(m * 100)
          momentumDir = mPct > 0 ? 'up' : 'down'
          momentumLabel = `${mPct > 0 ? '+' : '−'}${Math.abs(mPct)}%`
        }
      }

      return {
        id: lang.id,
        name: lang.name,
        color: lang.color,
        goal,
        ticks,
        badge,
        phase,
        totalHours: totalHours.toFixed(totalHours > 0 && totalHours < 100 ? 1 : 0),
        priorPct,
        loggedPct,
        reached: phase === 'maintaining',
        statusLabel,
        momentumLabel,
        momentumDir,
        pctLabel: pct === 0 ? '0%' : pct < 1 ? '<1%' : `${Math.round(pct)}%`,
        active: totalHours > 0 || recentHours > 0,
        sortKey: totalHours / base,
      }
    })
    .sort((a, b) => b.sortKey - a.sortKey)
})

// Languages with any progress lead; untouched ones collapse behind a toggle.
const activeRows = computed(() => rows.value.filter((r) => r.active))
const dormantRows = computed(() => rows.value.filter((r) => !r.active))
const visibleRows = computed(() => {
  if (activeRows.value.length === 0) return rows.value // fresh account: show targets
  return showAll.value ? rows.value : activeRows.value
})
</script>
