<template>
  <div class="relative overflow-hidden rounded-2xl border border-garden-100 bg-gradient-to-br from-garden-50/70 via-amber-50/30 to-white p-3 sm:p-4 mb-3 transition-shadow hover:shadow-card">
    <!-- a quiet sheaf motif in the corner -->
    <Wheat :size="76" class="pointer-events-none absolute -right-3 -bottom-4 text-garden-600/5 rotate-12" />
    <div class="relative flex items-start gap-3">
      <div class="w-8 h-8 rounded-full bg-garden-100 text-garden-700 flex items-center justify-center flex-shrink-0 ring-2 ring-white">
        <Wheat :size="16" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-stone-800 flex items-center gap-2">
            Weekly harvest
            <span class="text-[10px] font-medium text-garden-700 bg-garden-50 ring-1 ring-garden-100 px-1.5 py-0.5 rounded-full">harvest</span>
          </p>
          <span class="text-xs text-stone-400 flex-shrink-0">{{ relDay(item.occurred_on) }}</span>
        </div>
        <p class="text-sm text-stone-600 mt-1">
          <span class="font-medium">{{ item.isSelf ? 'You' : item.actorName }}</span>
          spent
          <span class="font-semibold text-stone-800 tabular-nums">{{ fmtDuration(item.minutes) }}</span>
          <template v-if="sessionCount > 0">
            across
            <span class="font-semibold text-stone-800 tabular-nums">{{ sessionCount }}</span>
            {{ sessionCount === 1 ? 'session' : 'sessions' }}
          </template>
          <span v-if="topLanguage">— most tended: <span class="font-medium text-stone-700">{{ topLanguage.name }}</span></span>
        </p>

        <div v-if="languages.length > 0" class="mt-2.5">
          <div class="flex h-3 rounded-full overflow-hidden ring-1 ring-inset ring-black/5">
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
              class="inline-flex items-center gap-1 text-[10px] text-stone-500"
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
