<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">Your Garden</h3>
      <div class="flex items-center gap-2 text-sm flex-wrap">
          <div v-if="!useMosaic" class="flex items-center gap-1">
          <span class="text-gray-500 text-xs">Less</span>
          <div class="flex gap-1">
            <div v-for="(level, index) in colorLevels" :key="index"
              class="rounded-sm"
              :style="{ backgroundColor: level, width: '12px', height: '12px' }"
            ></div>
          </div>
          <span class="text-gray-500 text-xs">More</span>
        </div>
        <div v-else class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs text-gray-400">Active:</span>
          <span v-for="(lang, i) in activeLanguages" :key="lang.id" class="flex items-center gap-1">
            <span class="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" :style="{ backgroundColor: lang.color }"></span>
            <span class="text-xs text-gray-500">{{ lang.name }}</span>
            <span v-if="i < activeLanguages.length - 1" class="text-gray-300">·</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Month View -->
    <div v-if="viewMode === 'month'" class="flex justify-center">
      <div class="w-full max-w-[770px]">
        <div class="flex gap-1 mb-1">
          <div v-for="day in fullDayLabels" :key="day"
            class="flex-1 text-xs text-gray-400 text-center py-1 font-medium"
          >
            {{ day }}
          </div>
        </div>
        <div v-for="(week, wi) in weeks" :key="wi" class="flex gap-1 mb-1">
          <div v-for="(day, di) in week" :key="di"
            class="flex-1 aspect-square rounded-md cursor-pointer relative overflow-hidden"
            :class="{
              'opacity-0 pointer-events-none': !day.inRange,
              'ring-2 ring-yellow-400/70 shadow-[0_0_8px_rgba(250,204,21,0.25)]': day.inRange && streakDaysSet.has(day.date)
            }"
            :style="day.inRange ? { backgroundColor: dayBgColor(day) } : { background: 'transparent' }"
            @mouseenter="day.inRange && showTooltip(day, $event)"
            @mouseleave="hideTooltip()"
          >
            <div v-if="day.inRange" class="absolute inset-0 pointer-events-none">
              <div v-if="useMosaic && day.totalMinutes > 0" class="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-[1.5px] p-[2px]">
                <div v-for="(color, si) in getMosaicGrid(day)" :key="si"
                  class="rounded-[1.5px]"
                  :class="color ? '' : 'invisible'"
                  :style="color ? { backgroundColor: color } : {}"
                ></div>
              </div>
              <span class="absolute top-0.5 left-1 text-[9px] font-medium text-gray-500/60 leading-none select-none z-10">
                {{ getDayNumber(day) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quarter View -->
    <div v-if="viewMode === 'quarter'" class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div class="flex gap-8 justify-center">
        <div v-for="(monthData, mi) in quarterMonths" :key="mi" class="flex-shrink-0 min-w-0">
          <div class="text-sm font-medium text-gray-600 mb-2 text-center">{{ monthData.label }}</div>
          <div class="flex gap-1">
            <div class="flex flex-col gap-1 mr-1">
              <div :style="{ height: dayLabelSizeQ + 'px' }"></div>
              <div v-for="day in fullDayLabels" :key="day"
                class="text-xs text-gray-400 flex items-center"
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
                    'ring-1 ring-yellow-400/70 shadow-[0_0_4px_rgba(250,204,21,0.2)]': day.inRange && streakDaysSet.has(day.date)
                  }"
                  :style="day.inRange ? { backgroundColor: dayBgColor(day), width: cellSizeQ + 'px', height: cellSizeQ + 'px' } : { width: cellSizeQ + 'px', height: cellSizeQ + 'px', background: 'transparent' }"
                  @mouseenter="day.inRange && showTooltip(day, $event)"
                  @mouseleave="hideTooltip()"
                >
                  <div v-if="day.inRange" class="absolute inset-0 pointer-events-none">
                    <div v-if="useMosaic && day.totalMinutes > 0" class="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-px p-px">
                      <div v-for="(color, si) in getMosaicGrid(day, 3)" :key="si"
                        class="rounded-[0.5px]"
                        :class="color ? '' : 'invisible'"
                        :style="color ? { backgroundColor: color } : {}"
                      ></div>
                    </div>
                    <span class="absolute top-px left-0.5 text-[6px] font-medium text-gray-500/60 leading-none select-none z-10">
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

    <!-- Year View -->
    <div v-if="viewMode === 'year'" class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div class="w-full">
        <div class="flex gap-1">
          <div class="flex flex-col gap-1 mr-2">
            <div class="h-3"></div>
            <div v-for="day in dayLabels" :key="day" class="h-3 text-xs text-gray-400 flex items-center">
              {{ day }}
            </div>
          </div>
          <div class="flex gap-1">
            <div v-for="(week, wi) in weeks" :key="wi" class="flex flex-col gap-1">
              <div v-if="wi % 4 === 0" class="h-3 text-xs text-gray-400">{{ getMonthLabel(week) }}</div>
              <div v-else class="h-3"></div>
              <div v-for="(day, di) in week" :key="di"
                class="garden-cell w-3 h-3 rounded-[1px] cursor-pointer relative overflow-hidden"
                :class="{
                  'ring-[0.5px] ring-yellow-400/70': streakDaysSet.has(day.date)
                }"
                :style="day.totalMinutes > 0 ? { backgroundColor: dayBgColor(day) } : { backgroundColor: '#f3f4f6' }"
                @mouseenter="showTooltip(day, $event)"
                @mouseleave="hideTooltip()"
              >
                <div v-if="useMosaic && day.totalMinutes > 0" class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px p-px">
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
import { ref, computed } from 'vue'

const props = defineProps({
  entries: { type: Array, required: true },
  languages: { type: Array, required: true },
  filter: { type: Object, default: () => ({ language: null, types: [] }) },
  viewMode: { type: String, default: 'month' },
  viewDate: { type: Date, default: () => new Date() }
})

const tooltip = ref(null)
let scrollCleanup = null

const showTooltip = (day, event) => {
  const cell = event.currentTarget
  const rect = cell.getBoundingClientRect()
  const above = rect.top > window.innerHeight / 2

  if (scrollCleanup) {
    window.removeEventListener('scroll', scrollCleanup)
  }

  scrollCleanup = () => { tooltip.value = null }
  window.addEventListener('scroll', scrollCleanup, { passive: true })

  const halfW = 100
  const x = Math.max(10 + halfW, Math.min(rect.left + rect.width / 2, window.innerWidth - 10 - halfW))
  const y = above ? rect.top - 8 : rect.bottom + 8

  tooltip.value = { day, x, y, above }
}

const hideTooltip = () => {
  if (scrollCleanup) {
    window.removeEventListener('scroll', scrollCleanup)
    scrollCleanup = null
  }
  tooltip.value = null
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fullDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dayLabelSizeQ = 16
const cellSizeQ = 25

const adjustColor = (hex, intensity) => {
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

const dayBgColor = (day) => {
  if (day.totalMinutes === 0) return '#f3f4f6'
  if (!useMosaic.value) {
    const lang = props.filter.language
      ? props.languages.find(l => l.id === props.filter.language)
      : props.languages[0]
    return getColorAtIntensity(lang ? lang.color : '#16a34a', day.totalMinutes)
  }
  return '#f3f4f6'
}

const getMosaicGrid = (day, gridSize = 5) => {
  if (day.totalMinutes === 0) return []
  const maxSquares = gridSize * gridSize
  const groups = getLanguageActivities(day)
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1])

  if (entries.length === 1) {
    const lang = props.languages.find(l => l.id === entries[0][0])
    const color = lang ? lang.color : '#16a34a'
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
    const lang = props.languages.find(l => l.id === a.langId)
    const color = lang ? lang.color : '#16a34a'
    for (let j = 0; j < a.floor; j++) colors.push(color)
  }
  while (colors.length < maxSquares) colors.push(null)
  return colors
}

const getCellColor = (day) => {
  if (day.totalMinutes === 0) return '#f3f4f6'

  if (props.filter.language) {
    const lang = props.languages.find(l => l.id === props.filter.language)
    const baseColor = lang ? lang.color : '#16a34a'
    return getColorAtIntensity(baseColor, day.totalMinutes)
  }

  const groups = getLanguageActivities(day)
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1])
  const topId = entries[0][0]
  const topLang = props.languages.find(l => l.id === topId)
  const topColor = topLang ? topLang.color : '#16a34a'

  if (entries.length === 1) {
    return getColorAtIntensity(topColor, day.totalMinutes)
  }

  const top = getColorAtIntensity(topColor, day.totalMinutes)

  if (entries.length === 2) {
    const secondId = entries[1][0]
    const secondLang = props.languages.find(l => l.id === secondId)
    const secondColor = secondLang ? secondLang.color : '#16a34a'
    const second = getColorAtIntensity(secondColor, day.totalMinutes)
    return `linear-gradient(90deg, ${top} 50%, ${second} 50%)`
  }

  const stops = []
  const count = Math.min(entries.length, 3)
  const pct = 100 / count
  for (let i = 0; i < count; i++) {
    const langId = entries[i][0]
    const lang = props.languages.find(l => l.id === langId)
    const c = lang ? lang.color : '#16a34a'
    const col = getColorAtIntensity(c, day.totalMinutes)
    const start = i * pct
    const end = (i + 1) * pct
    stops.push(`${col} ${start}%`)
    if (i < count - 1) stops.push(`${col} ${end}%`)
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

const getCellStyle = (day) => {
  if (!day.inRange) return { background: 'transparent' }
  const color = getCellColor(day)
  if (color.startsWith('linear-gradient')) {
    return { background: color }
  }
  return { backgroundColor: color }
}

const getDayNumber = (day) => {
  return parseInt(day.date.split('-')[2], 10)
}

const colorLevels = computed(() => {
  const isFiltered = !!props.filter.language
  const language = isFiltered ? props.languages.find(l => l.id === props.filter.language) : null
  const baseColor = language ? language.color : '#16a34a'
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

function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

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
      const lang = props.languages.find(l => l.id === e.languageId)
      return { language: lang ? lang.name : e.languageId, type: e.type, minutes: e.hours * 60 + e.minutes }
    })

    currentWeek.push({ date: dateStr, totalMinutes, activities, month: currentDate.getMonth(), inRange })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  if (currentWeek.length > 0) weeks.push(currentWeek)
  return weeks
}

function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

function getQuarterRange(date) {
  const q = Math.floor(date.getMonth() / 3)
  const start = new Date(date.getFullYear(), q * 3, 1)
  const end = new Date(date.getFullYear(), q * 3 + 3, 0)
  return { start, end }
}

function getYearRange(date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const end = new Date(date.getFullYear(), 11, 31)
  return { start, end }
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

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)
</script>
