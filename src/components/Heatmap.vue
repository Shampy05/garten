<template>
  <div>
    <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <h3 class="gp-title text-lg">Your Garden</h3>
      <div class="flex items-center gap-2 text-sm flex-wrap">
          <div v-if="!useMosaic" class="flex items-center gap-1">
          <span class="text-stone-400 text-xs">Less</span>
          <div class="flex gap-1">
            <div v-for="(level, index) in colorLevels" :key="index"
              class="rounded-sm"
              :style="{ backgroundColor: level, width: '12px', height: '12px' }"
            ></div>
          </div>
          <span class="text-stone-400 text-xs">More</span>
        </div>
        <div v-else class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs text-stone-400">Active:</span>
          <span v-for="(lang, i) in activeLanguages" :key="lang.id" class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" :style="{ backgroundColor: lang.color }"></span>
            <span class="text-xs text-stone-500">{{ lang.name }}</span>
            <span v-if="i < activeLanguages.length - 1" class="text-stone-300">·</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Month View -->
    <div v-if="viewMode === 'month'" class="flex justify-center">
      <div class="w-full max-w-[770px]">
        <div class="flex gap-1 mb-1">
          <div v-for="day in dayLabels" :key="day"
            class="flex-1 text-xs text-stone-400 text-center py-1 font-medium"
          >
            {{ day }}
          </div>
        </div>
        <div v-for="(week, wi) in weeks" :key="wi" class="flex gap-1 mb-1">
          <div v-for="(day, di) in week" :key="di"
            class="flex-1 aspect-square rounded-md cursor-pointer relative overflow-hidden"
            :class="{
              'opacity-0 pointer-events-none': !day.inRange,
              'border-2 border-blue-500': day.date === todayStr,
              'ring-2 ring-yellow-400/70 shadow-[0_0_8px_rgba(250,204,21,0.25)]': day.inRange && streakDaysSet.has(day.date)
            }"
            :style="day.inRange ? { backgroundColor: dayBgColor(day) } : { background: 'transparent' }"
            @mouseenter="day.inRange && hoverShow(day, $event)"
            @mouseleave="hoverHide()"
            @click="day.inRange && toggleTooltip(day, $event)"
          >
            <div v-if="day.inRange" class="absolute inset-0 pointer-events-none">
              <div v-if="showMosaic(day)" class="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-[1.5px] p-[2px]">
                <div v-for="(color, si) in getMosaicGrid(day)" :key="si"
                  class="rounded-[1.5px]"
                  :class="color ? '' : 'invisible'"
                  :style="color ? { backgroundColor: color } : {}"
                ></div>
              </div>
              <span class="absolute top-0.5 left-1 text-[9px] font-medium text-stone-500/70 leading-none select-none z-10">
                {{ getDayNumber(day) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quarter View -->
    <div v-if="viewMode === 'quarter'" class="relative">
      <div v-show="fade.left" class="pointer-events-none absolute inset-y-0 left-0 w-10 z-20 bg-gradient-to-r from-white to-transparent"></div>
      <div v-show="fade.right" class="pointer-events-none absolute inset-y-0 right-0 w-10 z-20 bg-gradient-to-l from-white to-transparent"></div>
      <div ref="scrollEl" @scroll="updateFade" class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div class="flex gap-8 justify-center">
        <div v-for="(monthData, mi) in quarterMonths" :key="mi" class="flex-shrink-0 min-w-0">
          <div class="text-sm font-medium text-stone-600 mb-2 text-center">{{ monthData.label }}</div>
          <div class="flex gap-1">
            <div class="flex flex-col gap-1 mr-1">
              <div :style="{ height: dayLabelSizeQ + 'px' }"></div>
              <div v-for="day in dayLabels" :key="day"
                class="text-xs text-stone-400 flex items-center"
                :style="{ height: cellSizeQ + 'px' }"
              >
                {{ day }}
              </div>
            </div>
            <div class="flex gap-1">
              <div v-for="(week, wi) in monthData.weeks" :key="wi" class="flex flex-col gap-1">
                <div :style="{ height: dayLabelSizeQ + 'px' }"></div>
                <div v-for="(day, di) in week" :key="di"
                  class="rounded-sm cursor-pointer relative overflow-hidden"
                  :class="{
                    'opacity-0 pointer-events-none': !day.inRange,
                    'border-2 border-blue-500': day.date === todayStr,
                    'ring-1 ring-yellow-400/70 shadow-[0_0_4px_rgba(250,204,21,0.2)]': day.inRange && streakDaysSet.has(day.date)
                  }"
                  :style="day.inRange ? { backgroundColor: dayBgColor(day), width: cellSizeQ + 'px', height: cellSizeQ + 'px' } : { width: cellSizeQ + 'px', height: cellSizeQ + 'px', background: 'transparent' }"
                  @mouseenter="day.inRange && hoverShow(day, $event)"
                  @mouseleave="hoverHide()"
                  @click="day.inRange && toggleTooltip(day, $event)"
                >
                  <div v-if="day.inRange" class="absolute inset-0 pointer-events-none">
                    <div v-if="showMosaic(day)" class="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-px p-px">
                      <div v-for="(color, si) in getMosaicGrid(day, 3)" :key="si"
                        class="rounded-[0.5px]"
                        :class="color ? '' : 'invisible'"
                        :style="color ? { backgroundColor: color } : {}"
                      ></div>
                    </div>
                    <span class="absolute top-px left-0.5 text-[6px] font-medium text-stone-500/70 leading-none select-none z-10">
                      {{ getDayNumber(day) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Year View -->
    <div v-if="viewMode === 'year'" class="relative">
      <div v-show="fade.left" class="pointer-events-none absolute inset-y-0 left-0 w-10 z-20 bg-gradient-to-r from-white to-transparent"></div>
      <div v-show="fade.right" class="pointer-events-none absolute inset-y-0 right-0 w-10 z-20 bg-gradient-to-l from-white to-transparent"></div>
      <div ref="scrollEl" @scroll="updateFade" class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div class="w-full">
        <div class="flex gap-1">
          <div class="flex flex-col gap-1 mr-2">
            <div class="h-3"></div>
            <div v-for="day in dayLabels" :key="day" class="h-3 text-xs text-stone-400 flex items-center">
              {{ day }}
            </div>
          </div>
          <div class="flex gap-1">
            <div v-for="(week, wi) in weeks" :key="wi" class="flex flex-col gap-1">
              <div v-if="wi % 4 === 0" class="h-3 text-xs text-stone-400">{{ getMonthLabel(week) }}</div>
              <div v-else class="h-3"></div>
              <div v-for="(day, di) in week" :key="di"
                class="garden-cell w-3 h-3 rounded-[1px] cursor-pointer relative overflow-hidden"
                :class="{
                  'opacity-0 pointer-events-none': !day.inRange,
                  'border border-blue-500': day.date === todayStr,
                  'ring-[0.5px] ring-yellow-400/70': day.inRange && streakDaysSet.has(day.date)
                }"
                :style="day.inRange ? { backgroundColor: day.totalMinutes > 0 ? dayBgColor(day) : '#f3f4f6' } : { background: 'transparent' }"
                @mouseenter="day.inRange && hoverShow(day, $event)"
                @mouseleave="hoverHide()"
                @click="day.inRange && toggleTooltip(day, $event)"
              >
                <div v-if="day.inRange && showMosaic(day)" class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px p-px">
                  <div v-for="(color, si) in getMosaicGrid(day, 2)" :key="si"
                    class="rounded-[0.5px]"
                    :class="color ? '' : 'invisible'"
                    :style="color ? { backgroundColor: color } : {}"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="tooltip"
      class="fixed z-50 px-3 py-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none leading-relaxed"
      :style="{
        left: tooltip.x + 'px',
        top: tooltip.y + 'px',
        transform: 'translateX(-50%)' + (tooltip.above ? ' translateY(-100%)' : ''),
        maxWidth: 'min(90vw, 340px)',
        minWidth: '160px'
      }"
    >
      <div class="font-semibold">{{ tooltip.day.date }}</div>
      <div v-if="tooltip.day.totalMinutes === 0">No activity</div>
      <div v-else>
        <div>Total: {{ formatTime(tooltip.day.totalMinutes) }}</div>
        <div v-for="(activity, idx) in tooltip.day.activities" :key="idx" class="text-gray-300 truncate">
          {{ activity.language }} {{ activity.type }}: {{ formatTime(activity.minutes) }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { localDateStr, daysBetween, getMonthRange, getQuarterRange, getYearRange } from '../lib/date.js'
import { toHexColor } from '../lib/color.js'
import { useLanguageLookup } from '../composables/useLanguageLookup.js'

const props = defineProps({
  entries: { type: Array, required: true },
  languages: { type: Array, required: true },
  filter: { type: Object, default: () => ({ language: null, types: [] }) },
  viewMode: { type: String, default: 'month' },
  viewDate: { type: Date, default: () => new Date() }
})

const { nameFor, colorFor, languageFor } = useLanguageLookup(() => props.languages)

const todayStr = localDateStr(new Date())
const tooltip = ref(null)
// "pinned" = surfaced by a tap/click rather than a passing hover. A pinned
// tooltip ignores mouseleave so it survives on touch (where there is no hover)
// and is dismissed explicitly by tapping the cell again or anywhere outside.
const pinned = ref(false)
let scrollCleanup = null

const positionTooltip = (day, event) => {
  const cell = event.currentTarget
  const rect = cell.getBoundingClientRect()
  const above = rect.top > window.innerHeight / 2

  if (scrollCleanup) {
    window.removeEventListener('scroll', scrollCleanup)
  }

  scrollCleanup = () => hideTooltip()
  window.addEventListener('scroll', scrollCleanup, { passive: true })

  const halfW = 100
  const x = Math.max(10 + halfW, Math.min(rect.left + rect.width / 2, window.innerWidth - 10 - halfW))
  const y = above ? rect.top - 8 : rect.bottom + 8

  tooltip.value = { day, x, y, above }
}

// Hover (desktop) — never overrides a pinned tooltip.
const hoverShow = (day, event) => {
  if (pinned.value) return
  positionTooltip(day, event)
}

const hoverHide = () => {
  if (pinned.value) return
  hideTooltip()
}

// Tap / click — works on every device. Toggles the same day off, otherwise
// pins the tapped day. stopPropagation keeps the document dismiss handler from
// firing for the very tap that opened it.
const toggleTooltip = (day, event) => {
  event.stopPropagation()
  if (pinned.value && tooltip.value && tooltip.value.day.date === day.date) {
    hideTooltip()
  } else {
    pinned.value = true
    positionTooltip(day, event)
  }
}

const hideTooltip = () => {
  if (scrollCleanup) {
    window.removeEventListener('scroll', scrollCleanup)
    scrollCleanup = null
  }
  pinned.value = false
  tooltip.value = null
}

// Dismiss a pinned tooltip when tapping/clicking anywhere outside a cell.
const onDocPointerDown = () => {
  if (pinned.value) hideTooltip()
}

// Edge-fade affordance: quarter/year views scroll horizontally with the
// scrollbar hidden, so a fade on each overflowing edge signals "more this way".
const scrollEl = ref(null)
const fade = ref({ left: false, right: false })
const updateFade = () => {
  const el = scrollEl.value
  if (!el) { fade.value = { left: false, right: false }; return }
  const maxScroll = el.scrollWidth - el.clientWidth
  fade.value = {
    left: el.scrollLeft > 1,
    right: el.scrollLeft < maxScroll - 1,
  }
}
const onResize = () => updateFade()

onMounted(() => {
  document.addEventListener('click', onDocPointerDown)
  window.addEventListener('resize', onResize)
  nextTick(updateFade)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocPointerDown)
  window.removeEventListener('resize', onResize)
  if (scrollCleanup) window.removeEventListener('scroll', scrollCleanup)
})

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dayLabelSizeQ = 16
const cellSizeQ = 25

const adjustColor = (color, intensity) => {
  const hex = toHexColor(color)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(243 + (r - 243) * intensity)}, ${Math.round(244 + (g - 244) * intensity)}, ${Math.round(246 + (b - 246) * intensity)})`
}

const getColorAtIntensity = (hex, minutes) => {
  if (minutes === 0) return '#f3f4f6'
  if (minutes <= 10) return adjustColor(hex, 0.15)
  if (minutes <= 20) return adjustColor(hex, 0.25)
  if (minutes <= 30) return adjustColor(hex, 0.35)
  if (minutes <= 45) return adjustColor(hex, 0.45)
  if (minutes <= 60) return adjustColor(hex, 0.55)
  if (minutes <= 90) return adjustColor(hex, 0.7)
  if (minutes <= 120) return adjustColor(hex, 0.85)
  return hex
}

const getLanguageActivities = (day) => {
  const groups = {}
  for (const a of day.activities) {
    const lang = props.languages.find(l => l.name === a.language)
    const id = lang ? lang.id : a.language
    groups[id] = (groups[id] || 0) + a.minutes
  }
  return groups
}

// Distinct languages studied on a given day.
const dayLanguageCount = (day) => Object.keys(getLanguageActivities(day)).length

// The mosaic only earns its grid when a day actually mixes languages. A
// single-language day is rendered as one clean solid block instead — so a
// tiled cell becomes a meaningful signal of a varied day.
const showMosaic = (day) => useMosaic.value && day.totalMinutes > 0 && dayLanguageCount(day) > 1

const dayBgColor = (day) => {
  if (day.totalMinutes === 0) return '#f3f4f6'
  if (!useMosaic.value) {
    const lang = props.filter.language
      ? languageFor(props.filter.language)
      : activeLanguages.value[0]
    return getColorAtIntensity(lang?.color || '#16a34a', day.totalMinutes)
  }
  // Mosaic mode: solid block for a single-language day, grey backdrop for the
  // multi-language mosaic to sit on.
  const ids = Object.keys(getLanguageActivities(day))
  if (ids.length === 1) return getColorAtIntensity(colorFor(ids[0]), day.totalMinutes)
  return '#f3f4f6'
}

const getMosaicGrid = (day, gridSize = 5) => {
  if (day.totalMinutes === 0) return []
  const maxSquares = gridSize * gridSize
  const groups = getLanguageActivities(day)
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1])

  if (entries.length === 1) {
    const color = colorFor(entries[0][0])
    return Array(maxSquares).fill(getColorAtIntensity(color, day.totalMinutes))
  }

  const totalMins = Object.values(groups).reduce((s, v) => s + v, 0)

  const allocation = entries.map(([langId, mins]) => {
    const exact = (mins / totalMins) * maxSquares
    return { langId, exact, floor: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })

  let sum = allocation.reduce((s, a) => s + a.floor, 0)
  const sorted = [...allocation].sort((a, b) => b.remainder - a.remainder)
  let ri = 0
  while (sum < maxSquares && ri < sorted.length) {
    sorted[ri].floor++
    sum++
    ri++
  }

  const colors = []
  for (const a of allocation) {
    const color = colorFor(a.langId)
    for (let j = 0; j < a.floor; j++) colors.push(color)
  }
  while (colors.length < maxSquares) colors.push(null)
  return colors
}

const getDayNumber = (day) => {
  return parseInt(day.date.split('-')[2], 10)
}

const colorLevels = computed(() => {
  const lang = props.filter.language
    ? languageFor(props.filter.language)
    : activeLanguages.value[0]
  const baseColor = lang?.color || '#16a34a'
  return [
    '#f3f4f6',
    adjustColor(baseColor, 0.15), adjustColor(baseColor, 0.25),
    adjustColor(baseColor, 0.35), adjustColor(baseColor, 0.45),
    adjustColor(baseColor, 0.55), adjustColor(baseColor, 0.7),
    adjustColor(baseColor, 0.85), baseColor
  ]
})

const useMosaic = computed(() =>
  !props.filter.language && activeLanguages.value.length > 1
)

const streakDaysSet = computed(() => {
  const dates = [...new Set(props.entries.map(e => e.date))].sort()
  const inStreak = new Set()
  let current = []
  for (let i = 0; i < dates.length; i++) {
    if (i === 0 || daysBetween(dates[i - 1], dates[i]) === 1) {
      current.push(dates[i])
    } else {
      if (current.length >= 3) current.forEach(d => inStreak.add(d))
      current = [dates[i]]
    }
  }
  if (current.length >= 3) current.forEach(d => inStreak.add(d))
  return inStreak
})

const activeLanguages = computed(() => {
  const activeIds = new Set(props.entries.map(e => e.languageId))
  return props.languages.filter(l => activeIds.has(l.id))
})

function generateWeeks(startDate, endDate) {
  const alignedStart = new Date(startDate)
  const dayOfWeek = alignedStart.getDay()
  const diff = alignedStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  alignedStart.setDate(diff)

  const weeks = []
  let currentWeek = []
  let currentDate = new Date(alignedStart)

  while (currentDate <= endDate || currentWeek.length > 0) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
      if (currentDate > endDate) break
    }

    const dateStr = localDateStr(currentDate)
    const inRange = currentDate >= startDate && currentDate <= endDate
    const dayEntries = inRange ? getEntriesForDate(dateStr) : []
    const totalMinutes = dayEntries.reduce((sum, e) => sum + (e.hours * 60 + e.minutes), 0)
    const activities = dayEntries.map(e => {
      return { language: nameFor(e.languageId), type: e.type, minutes: e.hours * 60 + e.minutes }
    })

    currentWeek.push({ date: dateStr, totalMinutes, activities, month: currentDate.getMonth(), inRange })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  if (currentWeek.length > 0) weeks.push(currentWeek)
  return weeks
}

const dateRange = computed(() => {
  switch (props.viewMode) {
    case 'month': return getMonthRange(props.viewDate)
    case 'quarter': return getQuarterRange(props.viewDate)
    case 'year': return getYearRange(props.viewDate)
    default: return getMonthRange(props.viewDate)
  }
})

const weeks = computed(() => generateWeeks(dateRange.value.start, dateRange.value.end))

const quarterMonths = computed(() => {
  if (props.viewMode !== 'quarter') return []
  const { start } = getQuarterRange(props.viewDate)
  const months = []
  for (let i = 0; i < 3; i++) {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const range = getMonthRange(monthDate)
    const monthLabel = monthDate.toLocaleString('default', { month: 'short' })
    months.push({ label: monthLabel, weeks: generateWeeks(range.start, range.end) })
  }
  return months
})

const getEntriesForDate = (dateStr) => {
  return props.entries.filter(entry => {
    if (entry.date !== dateStr) return false
    if (props.filter.language && entry.languageId !== props.filter.language) return false
    if (props.filter.types && props.filter.types.length > 0 && !props.filter.types.includes(entry.type)) return false
    return true
  })
}

const getMonthLabel = (week) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const firstDay = week.find(d => d.totalMinutes > 0)
  return firstDay ? monthNames[firstDay.month] : ''
}

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Re-evaluate the scroll fades whenever the rendered content or view changes
// (declared here so the immediate watch run sees weeks/quarterMonths defined).
watch(
  () => [props.viewMode, props.filter, weeks.value, quarterMonths.value],
  () => nextTick(updateFade),
  { deep: true }
)
</script>
