<template>
  <div class="space-y-3">
    <!-- Per-language filter chips — only when 2+ languages have words. -->
    <div v-if="languagesPresent.length > 1" class="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        @click="languageFilter = null"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        :class="!languageFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        All
      </button>
      <button
        v-for="lang in languagesPresent"
        :key="lang.id"
        type="button"
        @click="languageFilter = lang.id"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5"
        :class="languageFilter === lang.id ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color || '#a8a29e' }"></span>
        {{ lang.name }}
        <span class="tabular-nums opacity-70">{{ lang.count }}</span>
      </button>
    </div>

    <div v-if="!filteredWords.length" class="text-center py-6 text-sm text-stone-400">
      No words here yet.
    </div>
    <div v-else class="space-y-2">
      <WordCard
        v-for="word in filteredWords"
        :key="word.id"
        :word="word"
        :language-color="colorFor(word.languageId)"
        :source-title="sourceTitles[word.sourceBookId] || null"
        @update="$emit('update', $event)"
        @remove="$emit('remove', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { isDue } from '../../lib/srs.js'
import WordCard from './WordCard.vue'

const props = defineProps({
  words: { type: Array, default: () => [] },
  // The user's tracked languages ({ id, name, color }) for chip labels/colors.
  languages: { type: Array, default: () => [] },
  // sourceBookId → title map, resolved by the parent (soft references).
  sourceTitles: { type: Object, default: () => ({}) },
})

defineEmits(['update', 'remove'])

const languageFilter = ref(null)

const langById = computed(() => new Map(props.languages.map((l) => [l.id, l])))

function colorFor(languageId) {
  return langById.value.get(languageId)?.color || null
}

// Languages that actually have words, with counts. A language whose row was
// deleted still shows under its raw id so the words remain reachable.
const languagesPresent = computed(() => {
  const counts = new Map()
  for (const w of props.words) counts.set(w.languageId, (counts.get(w.languageId) || 0) + 1)
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      count,
      name: langById.value.get(id)?.name || id,
      color: langById.value.get(id)?.color || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Due words first (they're what the garden wants attention on), then newest
// plantings.
const filteredWords = computed(() => {
  const list = props.words.filter((w) => !languageFilter.value || w.languageId === languageFilter.value)
  return list.slice().sort((a, b) => {
    const ad = isDue(a) ? 0 : 1
    const bd = isDue(b) ? 0 : 1
    if (ad !== bd) return ad - bd
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })
})

// If the filtered language loses its last word, reset so the user isn't
// stranded on an empty view.
watch(languagesPresent, (langs) => {
  if (languageFilter.value && !langs.find((l) => l.id === languageFilter.value)) {
    languageFilter.value = null
  }
})
</script>
