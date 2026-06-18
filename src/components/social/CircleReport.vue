<template>
  <div class="p-4 rounded-xl bg-gradient-to-br from-garden-50 to-emerald-50 border border-garden-100">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex items-center gap-2.5">
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
          :class="item.isSelf ? 'bg-stone-100 text-stone-600' : 'bg-garden-100 text-garden-700'"
        >
          {{ item.actorName[0].toUpperCase() }}
        </div>
        <div>
          <div class="text-sm font-medium text-stone-800">
            {{ item.isSelf ? 'Your' : item.actorName + "'s" }} weekly report
          </div>
          <div class="text-xs text-stone-500">{{ relDay(item.occurred_on) }}</div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="text-lg font-display font-bold text-stone-800 tabular-nums">{{ fmtHours(item.minutes) }}</div>
        <div class="text-[10px] text-stone-400 uppercase tracking-wide">this week</div>
      </div>
    </div>

    <div class="flex items-center gap-4 text-sm text-stone-600 mb-3">
      <span>{{ item.session_count || 0 }} sessions</span>
      <span v-if="topLanguage">
        Top: <span class="font-medium" :style="{ color: topLanguage.color }">{{ topLanguage.name }}</span>
      </span>
    </div>

    <div v-if="languages.length > 0" class="mb-3">
      <div class="w-full h-2.5 rounded-full overflow-hidden flex bg-stone-100">
        <div
          v-for="lang in languages"
          :key="lang.name"
          class="h-2.5"
          :style="{ width: lang.percent + '%', backgroundColor: lang.color }"
        ></div>
      </div>
      <div class="flex flex-wrap gap-3 mt-2">
        <span v-for="lang in languages" :key="lang.name" class="inline-flex items-center gap-1 text-xs text-stone-500">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color }"></span>
          {{ lang.name }} {{ fmtHours(lang.minutes) }}
        </span>
      </div>
    </div>

    <div v-if="commitments.length > 0" class="mb-3 space-y-1">
      <div
        v-for="c in commitments"
        :key="c.language_name"
        class="flex items-center justify-between text-xs"
      >
        <span class="text-stone-500">{{ c.language_name }} commitment</span>
        <span
          class="font-medium"
          :class="c.logged_minutes >= c.target_minutes ? 'text-garden-600' : 'text-stone-600'"
        >
          {{ fmtHours(c.logged_minutes) }} / {{ fmtHours(c.target_minutes) }}
        </span>
      </div>
    </div>

    <div class="flex items-center justify-between mt-3 pt-3 border-t border-garden-100/50">
      <ReactionBar :event-id="item.id" compact @toggle="(k) => social.toggleReaction(item.id, k)" />
      <div class="flex items-center gap-3">
        <WaterButton
          v-if="!item.isSelf"
          :recipient-id="item.actor_id"
          :name="item.actorName"
          compact
        />
        <button
          @click.stop="$emit('open')"
          class="text-stone-400 hover:text-garden-600 transition-colors"
          title="Open notes"
        >
          <MessageCircle :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { MessageCircle } from 'lucide-vue-next'
import ReactionBar from './ReactionBar.vue'
import WaterButton from './WaterButton.vue'

const props = defineProps({
  item: { type: Object, required: true }
})

defineEmits(['open'])

const social = inject('social')

const details = computed(() => props.item.details || {})
const topLanguage = computed(() => details.value.top_language || null)
const languages = computed(() => {
  const list = details.value.languages || []
  const total = list.reduce((sum, l) => sum + (l.minutes || 0), 0)
  if (total === 0) return []
  return list.map((l) => ({
    ...l,
    percent: Math.max(1, Math.round((l.minutes / total) * 100))
  }))
})
const commitments = computed(() => details.value.commitments || [])

function fmtHours(mins) {
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
