<template>
  <div
    class="rounded-xl border transition-all duration-200"
    :class="isCollapsed
      ? 'bg-white border-stone-100'
      : 'bg-gradient-to-br from-garden-50 to-emerald-50 border-garden-100'"
  >
    <div class="p-4">
      <!-- Summary row — always visible -->
      <div class="flex items-start gap-3">
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
          :class="item.isSelf ? 'bg-stone-100 text-stone-600' : 'bg-garden-100 text-garden-700'"
        >
          {{ item.actorName[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-stone-800">
            {{ item.isSelf ? 'Your' : item.actorName + "'s" }} weekly report
          </div>
          <div class="text-xs text-stone-500 mt-0.5">
            {{ relDay(item.occurred_on) }}
            <template v-if="item.session_count"> · {{ item.session_count }} sessions</template>
            <template v-if="topLanguage"> · Top: <span class="font-medium" :style="{ color: topLanguage.color }">{{ topLanguage.name }}</span></template>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <div class="text-right">
            <div class="text-base font-display font-bold text-stone-800 tabular-nums">{{ fmtHours(item.minutes) }}</div>
            <div class="text-[10px] text-stone-400 uppercase tracking-wide">this week</div>
          </div>
          <!-- Expand / collapse toggle (only when startCollapsed mode is on) -->
          <button
            v-if="startCollapsed"
            @click.stop="isCollapsed = !isCollapsed"
            class="p-1 text-stone-300 hover:text-stone-500 transition-colors"
            :title="isCollapsed ? 'Expand' : 'Collapse'"
          >
            <ChevronDown
              :size="16"
              class="transition-transform duration-200"
              :class="{ 'rotate-180': !isCollapsed }"
            />
          </button>
        </div>
      </div>

      <!-- Expandable detail -->
      <div v-if="!isCollapsed" class="mt-3 space-y-3 animate-fade-up">
        <div v-if="languages.length > 0">
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

        <div v-if="commitments.length > 0" class="space-y-1">
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
      </div>

      <!-- Actions — always visible -->
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-stone-100/60">
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
  </div>
</template>

<script setup>
import { computed, ref, inject } from 'vue'
import { MessageCircle, ChevronDown } from 'lucide-vue-next'
import ReactionBar from './ReactionBar.vue'
import WaterButton from './WaterButton.vue'

const props = defineProps({
  item: { type: Object, required: true },
  startCollapsed: { type: Boolean, default: false }
})

defineEmits(['open'])

const social = inject('social')
const isCollapsed = ref(props.startCollapsed)

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
