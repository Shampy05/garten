<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
    <h3 class="font-display text-lg font-semibold text-gray-800 mb-3">Find a gardener</h3>
    <div class="relative">
      <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        v-model="query"
        type="text"
        placeholder="Search by username"
        autocapitalize="none"
        autocomplete="off"
        spellcheck="false"
        class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>

    <div v-if="query.trim().length >= 2" class="mt-3 space-y-1.5">
      <div v-if="searching" class="text-xs text-gray-400 py-3 text-center">Searching…</div>
      <div v-else-if="results.length === 0" class="text-xs text-gray-400 py-3 text-center">
        No gardeners found by that name.
      </div>
      <div
        v-for="u in results"
        :key="u.id"
        class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div class="w-8 h-8 rounded-full bg-green-50 text-green-700 flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
          {{ (u.display_name || u.username)[0].toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-gray-700 truncate">{{ u.display_name || u.username }}</div>
          <div class="text-xs text-gray-400 truncate">@{{ u.username }}</div>
        </div>
        <button
          v-if="!sent.has(u.id)"
          @click="add(u)"
          class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <UserPlus :size="13" /> Add
        </button>
        <span v-else class="flex-shrink-0 text-xs text-gray-400 px-2.5 py-1.5">Requested</span>
      </div>
    </div>
    <p v-else-if="query.trim().length > 0" class="text-xs text-gray-400 mt-2">Keep typing — at least two letters.</p>
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue'
import { Search, UserPlus } from 'lucide-vue-next'

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
