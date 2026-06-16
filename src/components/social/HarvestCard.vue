<template>
  <div class="bg-amber-50/70 rounded-xl border border-amber-100 p-3 sm:p-4 mb-3">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <Wheat :size="16" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium text-gray-800">Weekly harvest</p>
          <span class="text-xs text-gray-400">{{ relDay(item.occurred_on) }}</span>
        </div>
        <p class="text-sm text-gray-600 mt-0.5">
          <span class="font-medium">{{ item.isSelf ? 'You' : item.actorName }}</span>
          spent
          <span class="font-medium text-gray-800">{{ fmtDuration(item.minutes) }}</span>
          <template v-if="sessionCount > 0">
            across
            <span class="font-medium text-gray-800">{{ sessionCount }}</span>
            {{ sessionCount === 1 ? 'session' : 'sessions' }}
          </template>
          <span v-if="topLanguage">— most tended: {{ topLanguage.name }}</span>
        </p>

        <div v-if="languages.length > 0" class="mt-2.5">
          <div class="flex h-3 rounded-full overflow-hidden">
            <div
              v-for="lang in languages"
              :key="lang.name"
              class="h-full"
              :style="{ width: lang.share + '%', backgroundColor: lang.color || '#9ca3af' }"
              :title="`${lang.name}: ${fmtDuration(lang.minutes)}`"
            ></div>
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-1.5">
            <span
              v-for="lang in languages"
              :key="lang.name"
              class="inline-flex items-center gap-1 text-[10px] text-gray-500"
            >
              <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: lang.color || '#9ca3af' }"></span>
              {{ lang.name }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Wheat } from 'lucide-vue-next'

const props = defineProps({
  item: { type: Object, required: true }
})

const sessionCount = computed(() => {
  if (typeof props.item.session_count === 'number') return props.item.session_count
  return props.item.details?.session_count || 0
})

const topLanguage = computed(() => {
  if (props.item.details?.top_language?.name) return props.item.details.top_language
  if (props.item.language_name) {
    return { name: props.item.language_name, color: props.item.language_color, minutes: props.item.minutes }
  }
  return null
})

const languages = computed(() => {
  const raw = props.item.details?.languages || []
  const list = raw.length > 0 ? raw : topLanguage.value ? [topLanguage.value] : []
  const total = list.reduce((sum, l) => sum + (Number(l.minutes) || 0), 0)
  if (total === 0) return []
  return list
    .filter((l) => (l.minutes || 0) > 0)
    .map((l) => ({
      ...l,
      share: Math.max(1, Math.round(((Number(l.minutes) || 0) / total) * 100))
    }))
})

function fmtDuration(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

function relDay(dateStr) {
  if (!dateStr) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((today - d) / 86400000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>
