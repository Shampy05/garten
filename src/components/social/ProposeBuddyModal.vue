<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="gp-card gp-pad w-full max-w-sm animate-fade-up">
        <div class="flex items-center justify-between mb-4">
          <h3 class="gp-title text-lg">Grow together</h3>
          <button @click="$emit('close')" class="text-stone-400 hover:text-stone-600">
            <X :size="18" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Buddy</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="f in friends"
                :key="f.friend_id"
                @click="selectedFriend = f"
                class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-sm border transition-all"
                :class="selectedFriend?.friend_id === f.friend_id
                  ? 'border-garden-400 bg-garden-50 text-garden-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'"
              >
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  :class="selectedFriend?.friend_id === f.friend_id ? 'bg-garden-100 text-garden-700' : 'bg-stone-100 text-stone-500'"
                >
                  {{ (f.display_name || f.username)[0].toUpperCase() }}
                </span>
                {{ f.display_name || f.username }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Shared language</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="lang in languages"
                :key="lang.id"
                @click="selectedLang = lang"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all"
                :class="selectedLang?.id === lang.id
                  ? 'border-garden-400 bg-garden-50 text-garden-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color }"></span>
                {{ lang.name }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Combined target this week</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <button
                v-for="preset in presets"
                :key="preset"
                @click="targetMinutes = preset"
                class="px-3 py-1.5 rounded-lg text-sm border transition-all"
                :class="targetMinutes === preset
                  ? 'border-garden-400 bg-garden-50 text-garden-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'"
              >
                {{ fmtHours(preset) }}
              </button>
            </div>
            <input
              v-model.number="targetMinutes"
              type="number"
              min="1"
              step="15"
              class="gp-input"
              placeholder="Minutes"
            />
          </div>

          <button
            @click="propose"
            :disabled="!selectedFriend || !selectedLang || targetMinutes < 1"
            class="gp-btn-primary w-full py-2.5 text-sm"
          >
            Send invite
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  visible: { type: Boolean, required: true },
  languages: { type: Array, default: () => [] },
  friends: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'propose'])

const selectedFriend = ref(null)
const selectedLang = ref(null)
const targetMinutes = ref(180)
const presets = [120, 180, 300, 420]

// Default the pickers each time the modal opens, so a stale selection from a
// previous proposal never leaks in.
watch(
  () => props.visible,
  (open) => {
    if (open) {
      selectedFriend.value = props.friends[0] || null
      selectedLang.value = props.languages[0] || null
      targetMinutes.value = 180
    }
  }
)

function fmtHours(mins) {
  const m = Number(mins) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

function propose() {
  if (!selectedFriend.value || !selectedLang.value || targetMinutes.value < 1) return
  emit('propose', {
    friendId: selectedFriend.value.friend_id,
    language: selectedLang.value,
    targetMinutes: targetMinutes.value
  })
}
</script>
