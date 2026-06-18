<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
    @click.self="close"
  >
    <div class="absolute inset-0 bg-black/30" @click="close"></div>
    <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <h3 class="text-sm font-semibold text-stone-800">Notifications</h3>
        <button
          @click="close"
          class="text-stone-400 hover:text-stone-600"
          aria-label="Close"
        >
          <X :size="18" />
        </button>
      </div>

      <div class="max-h-[70vh] overflow-y-auto">
        <div v-if="items.length === 0" class="px-4 py-8 text-center text-sm text-stone-500">
          No new notifications.
        </div>

        <div v-else class="divide-y divide-stone-100">
          <button
            v-for="item in items"
            :key="item.id"
            class="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors"
            @click="handleClick(item)"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                :class="item.type === 'water' ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'"
              >
                <component :is="item.type === 'water' ? Droplets : MessageSquare" :size="15" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-stone-800">
                  <span class="font-medium">{{ item.actorName }}</span>
                  {{ item.type === 'water' ? 'watered your garden today.' : 'commented on ' + item.eventTitle + ':' }}
                </p>
                <p v-if="item.body" class="text-xs text-stone-500 mt-0.5 truncate">{{ item.body }}</p>
                <p class="text-[10px] text-stone-400 mt-1">{{ fmtTime(item.created_at) }}</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div v-if="items.length > 0" class="px-4 py-2.5 border-t border-stone-100 bg-stone-50">
        <button
          @click="markAllRead"
          class="text-xs font-medium text-stone-600 hover:text-stone-900"
        >
          Mark all read
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { X, Droplets, MessageSquare } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Boolean, required: true }
})
const emit = defineEmits(['update:modelValue', 'open-event'])

const social = inject('social')
const {
  watersReceived,
  recentCommentsOnMine,
  feed,
  openEventDetail,
  markNotificationsRead
} = social

function eventTitle(eventId) {
  const event = feed.value.find((e) => e.id === eventId)
  if (!event) return 'your dispatch'
  if (event.kind === 'summary') return 'your weekly harvest'
  if (event.kind === 'milestone') return `your ${event.language_name || ''} milestone`
  return event.language_name ? `your ${event.language_name} session` : 'your session'
}

const items = computed(() => {
  const waters = (watersReceived.value || []).map((w) => ({
    id: 'water-' + w.id,
    type: 'water',
    actorName: w.senderName,
    eventTitle: '',
    body: '',
    created_at: w.watered_on + 'T00:00:00',
    eventId: null
  }))
  const comments = (recentCommentsOnMine.value || []).map((c) => ({
    id: 'comment-' + c.id,
    type: 'comment',
    actorName: c.authorName,
    eventTitle: eventTitle(c.event_id),
    body: c.body,
    created_at: c.created_at,
    eventId: c.event_id
  }))
  return [...waters, ...comments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
})

function close() {
  emit('update:modelValue', false)
}

function handleClick(item) {
  if (item.eventId) {
    const event = feed.value.find((e) => e.id === item.eventId)
    if (event) emit('open-event', event)
  }
  close()
}

function markAllRead() {
  markNotificationsRead()
}

function fmtTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
</script>
