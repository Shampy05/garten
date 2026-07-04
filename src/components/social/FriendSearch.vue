<template>
  <div class="gp-card gp-pad">
    <h3 class="gp-title text-lg mb-3">Find a gardener</h3>
    <div class="relative">
      <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        v-model="query"
        type="text"
        placeholder="Search by username"
        autocapitalize="none"
        autocomplete="off"
        spellcheck="false"
        class="gp-input pl-9"
      />
    </div>

    <div v-if="query.trim().length >= 2" class="mt-3 space-y-1.5">
      <div v-if="searching" class="text-xs text-stone-400 py-3 text-center">Searching…</div>
      <div v-else-if="results.length === 0" class="text-xs text-stone-400 py-3 text-center">
        No gardeners found by that name.
      </div>
      <div
        v-for="u in results"
        :key="u.id"
        class="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors"
      >
        <BloomAvatar :seed="u.id" :size="32" :name="u.display_name || u.username" :variant="u.avatar_variant" />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-stone-700 truncate">{{ u.display_name || u.username }}</div>
          <div class="text-xs text-stone-400 truncate">@{{ u.username }}</div>
        </div>
        <button
          v-if="!sent.has(u.id)"
          @click="add(u)"
          class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-garden-700 bg-garden-50 hover:bg-garden-100 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <UserPlus :size="13" /> Add
        </button>
        <span v-else class="flex-shrink-0 text-xs text-stone-400 px-2.5 py-1.5">Requested</span>
      </div>
    </div>
    <p v-else-if="query.trim().length > 0" class="text-xs text-stone-400 mt-2">Keep typing — at least two letters.</p>
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue'
import { Search, UserPlus } from 'lucide-vue-next'
import BloomAvatar from '../BloomAvatar.vue'

const social = inject('social')
const query = ref('')
const results = ref([])
const searching = ref(false)
const sent = ref(new Set())

// Debounced search. A monotonically increasing token discards stale responses
// so a slow earlier request can't overwrite a newer one.
let token = 0
watch(query, (q) => {
  const trimmed = q.trim()
  if (trimmed.length < 2) {
    results.value = []
    searching.value = false
    return
  }
  searching.value = true
  const current = ++token
  setTimeout(async () => {
    if (current !== token) return
    const found = await social.searchUsers(trimmed)
    if (current !== token) return
    results.value = found
    searching.value = false
  }, 300)
})

async function add(u) {
  // Optimistically flip the button; the request reload happens in the composable.
  sent.value = new Set(sent.value).add(u.id)
  await social.sendRequest(u.id)
}
</script>
