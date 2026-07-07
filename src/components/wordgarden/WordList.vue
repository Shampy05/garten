<template>
  <div class="space-y-3">
    <!-- Per-language filter chips — always visible (even with 1 language) so
         the filter affordance is discoverable. With one language the "All"
         chip and the language chip are functionally equivalent; with 2+
         languages they narrow the list to a specific garden. Shared with the
         Plant-a-word form: a single languageFilter lives in the parent so
         picking a language in the form narrows this list and vice versa. -->
    <div v-if="languagesPresent.length" class="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        @click="setFilter(null)"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
        :class="!languageFilter ? 'bg-stone-800 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        All
      </button>
      <button
        v-for="lang in languagesPresent"
        :key="lang.id"
        type="button"
        @click="setFilter(lang.id)"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5"
        :class="languageFilter === lang.id ? 'bg-garden-600 text-white shadow-pill' : 'bg-white border border-line text-stone-600 hover:border-stone-300'"
      >
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lang.color || '#a8a29e' }"></span>
        {{ lang.name }}
        <span class="tabular-nums opacity-70">{{ lang.count }}</span>
      </button>
    </div>

    <div v-if="!filteredWords.length" class="text-center py-6 text-sm text-stone-400">
      <template v-if="languageFilter && filterName">
        No <span class="font-medium text-stone-600">{{ filterName }}</span> words here yet.
      </template>
      <template v-else>
        No words here yet.
      </template>
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
import { computed } from 'vue'
import { isDue } from '../../lib/srs.js'
import WordCard from './WordCard.vue'

const props = defineProps({
  words: { type: Array, default: () => [] },
  // The user's tracked languages ({ id, name, color }) for chip labels/colors.
  languages: { type: Array, default: () => [] },
  // sourceBookId → title map, resolved by the parent (soft references).
  sourceTitles: { type: Object, default: () => ({}) },
  // Active language filter, owned by the parent so the Plant-a-word form
  // shares it. `null` = show all languages.
  languageFilter: { type: String, default: null },
})

const emit = defineEmits(['update', 'remove', 'update:languageFilter'])

const langById = computed(() => new Map(props.languages.map((l) => [l.id, l])))

function colorFor(languageId) {
  return langById.value.get(languageId)?.color || null
}

function setFilter(id) {
  emit('update:languageFilter', id)
}

const filterName = computed(() => langById.value.get(props.languageFilter)?.name || '')

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
  const list = props.words.filter((w) => !props.languageFilter || w.languageId === props.languageFilter)
  return list.slice().sort((a, b) => {
    const ad = isDue(a) ? 0 : 1
    const bd = isDue(b) ? 0 : 1
    if (ad !== bd) return ad - bd
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })
})
</script>
