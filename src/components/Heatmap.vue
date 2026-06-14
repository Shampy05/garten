<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">Your Garden</h3>
      <div class="flex items-center gap-4 text-sm">
        <div class="flex items-center gap-1">
          <span class="text-gray-500">Less</span>
          <div class="flex gap-1">
            <div v-for="(level, index) in colorLevels" :key="index"
              class="rounded-sm"
              :style="{ backgroundColor: level, width: '12px', height: '12px' }"
            ></div>
          </div>
          <span class="text-gray-500">More</span>
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
            class="flex-1 aspect-square rounded-md cursor-pointer relative"
            :class="{ 'opacity-0 pointer-events-none': !day.inRange }"
            :style="day.inRange ? getCellStyle(day) : { background: 'transparent' }"
            @mouseenter="day.inRange && (hoveredDay = day)"
            @mouseleave="hoveredDay = null"
          >
            <div v-if="day.inRange" class="absolute inset-0 overflow-hidden rounded-md pointer-events-none">
              <span class="absolute top-0.5 left-1 text-[9px] font-medium text-gray-500/60 leading-none select-none">
                {{ getDayNumber(day) }}
              </span>
              <div v-if="day.totalMinutes > 0" class="absolute bottom-0 left-0 right-0 h-[3px] flex rounded-b-sm overflow-hidden">
                <div v-for="(seg, si) in getStackBars(day)" :key="si"
                  class="h-full"
                  :style="{ width: seg.percent + '%', backgroundColor: seg.color }"
                ></div>
              </div>
            </div>
            <div v-if="hoveredDay && hoveredDay.date === day.date && hoveredDay.inRange"
              class="absolute left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-auto"
              :class="wi < 2 ? 'top-full mt-1' : 'bottom-full mb-1'"
            >
              <div class="font-semibold">{{ day.date }}</div>
              <div v-if="day.totalMinutes === 0">No activity</div>
              <div v-else>
                <div>Total: {{ formatTime(day.totalMinutes) }}</div>
                <div v-for="(activity, idx) in day.activities" :key="idx" class="text-gray-300">
                  {{ activity.language }} {{ activity.type }}: {{ formatTime(activity.minutes) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quarter View -->
    <div v-if="viewMode === 'quarter'" class="overflow-x-auto">
      <div class="flex gap-8 justify-center">
        <div v-for="(monthData, mi) in quarterMonths" :key="mi" class="flex-shrink-0">
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
                  class="rounded-sm cursor-pointer relative"
                  :class="{ 'opacity-0 pointer-events-none': !day.inRange }"
                  :style="day.inRange ? { ...getCellStyle(day), width: cellSizeQ + 'px', height: cellSizeQ + 'px' } : { width: cellSizeQ + 'px', height: cellSizeQ + 'px', background: 'transparent' }"
                  @mouseenter="day.inRange && (hoveredDay = day)"
                  @mouseleave="hoveredDay = null"
                >
                  <div v-if="day.inRange" class="absolute inset-0 overflow-hidden rounded-sm pointer-events-none">
                    <span class="absolute top-0.5 left-1 text-[8px] font-medium text-gray-500/60 leading-none select-none">
                      {{ getDayNumber(day) }}
                    </span>
                    <div v-if="day.totalMinutes > 0" class="absolute bottom-0 left-0 right-0 h-[2px] flex rounded-b-sm overflow-hidden">
                      <div v-for="(seg, si) in getStackBars(day)" :key="si"
                        class="h-full"
                        :style="{ width: seg.percent + '%', backgroundColor: seg.color }"
                      ></div>
                    </div>
                  </div>
                  <div v-if="hoveredDay && hoveredDay.date === day.date && hoveredDay.inRange"
                    class="absolute left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-auto"
                    :class="wi < 2 ? 'top-full mt-1' : 'bottom-full mb-1'"
                  >
                    <div class="font-semibold">{{ day.date }}</div>
                    <div v-if="day.totalMinutes === 0">No activity</div>
                    <div v-else>
                      <div>Total: {{ formatTime(day.totalMinutes) }}</div>
                      <div v-for="(activity, idx) in day.activities" :key="idx" class="text-gray-300">
                        {{ activity.language }} {{ activity.type }}: {{ formatTime(activity.minutes) }}
                      </div>
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
    <div v-if="viewMode === 'year'" class="overflow-x-auto">
      <div class="min-w-max">
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
                class="garden-cell w-3 h-3 rounded-sm cursor-pointer relative"
                :style="getCellStyle(day)"
                @mouseenter="hoveredDay = day"
                @mouseleave="hoveredDay = null"
              >
                <div v-if="hoveredDay && hoveredDay.date === day.date"
                  class="absolute left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-auto"
                  :class="wi < 2 ? 'top-full mt-1' : 'bottom-full mb-1'"
                >
                  <div class="font-semibold">{{ day.date }}</div>
                  <div v-if="day.totalMinutes === 0">No activity</div>
                  <div v-else>
                    <div>Total: {{ formatTime(day.totalMinutes) }}</div>
                    <div v-for="(activity, idx) in day.activities" :key="idx" class="text-gray-300">
                      {{ activity.language }} {{ activity.type }}: {{ formatTime(activity.minutes) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
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

const hoveredDay = ref(null)
const dayLabels = ['Mon', 'Wed', 'Fri']
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
  if (minutes <= 15) return adjustColor(hex, 0.2)
  if (minutes <= 30) return adjustColor(hex, 0.4)
  if (minutes <= 60) return adjustColor(hex, 0.7)
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

const getStackBars = (day) => {
  if (day.totalMinutes === 0) return []
  const groups = getLanguageActivities(day)
  const total = Object.values(groups).reduce((s, v) => s + v, 0)
  return Object.entries(groups).map(([id, mins]) => {
    const lang = props.languages.find(l => l.id === id)
    return { color: lang ? lang.color : '#16a34a', percent: (mins / total) * 100 }
  })
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

  const secondId = entries[1][0]
  const secondLang = props.languages.find(l => l.id === secondId)
  const secondColor = secondLang ? secondLang.color : '#16a34a'
  const top = getColorAtIntensity(topColor, day.totalMinutes)
  const second = getColorAtIntensity(secondColor, day.totalMinutes)
  return `linear-gradient(135deg, ${top} 50%, ${second} 50%)`
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
  return ['#f3f4f6', adjustColor(baseColor, 0.2), adjustColor(baseColor, 0.4), adjustColor(baseColor, 0.7), baseColor]
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
</script>
