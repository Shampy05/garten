<template>
  <!-- The queue's one spotlighted recommendation. A quiet garden wash and
       hairline set it apart from the plain QueueCards below without shouting —
       same register as the shelf's amber cap note. -->
  <div class="rounded-2xl border border-garden-200 bg-gradient-to-b from-garden-50/70 to-white shadow-card p-4 flex gap-4">
    <div class="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
      <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
      <BookOpen v-else :size="20" class="text-stone-300" />
    </div>

    <div class="flex flex-col min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-garden-700">
          <Sparkles :size="12" />
          Your next read
        </span>
        <span class="flex-1"></span>
        <button
          @click="$emit('edit', book)"
          class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          title="Edit"
          aria-label="Edit"
        >
          <Pencil :size="13" />
        </button>
      </div>

      <h4 class="text-base font-semibold text-stone-800 leading-snug line-clamp-2 mt-0.5">{{ book.title }}</h4>
      <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>

      <!-- The ladder's why — the whole point of the card. -->
      <p class="text-xs text-stone-600 italic mt-1.5">{{ reason }}</p>

      <div class="flex flex-wrap items-center gap-2 mt-auto pt-2.5">
        <button
          @click="$emit('move-to-reading', book)"
          class="gp-btn-primary px-4 py-1.5 text-xs inline-flex items-center gap-1.5"
        >
          <Play :size="12" />
          Start reading
        </button>
        <span class="inline-flex items-center gap-1.5 text-[11px] font-medium text-garden-700 bg-garden-50 border border-garden-100 px-2 py-0.5 rounded-full">
          <span
            v-if="languageColor"
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: languageColor }"
          ></span>
          {{ nameForCode(book.languageCode) }}
        </span>
        <span
          v-if="book.record?.totalPages"
          class="text-[11px] text-stone-400 tabular-nums"
        >
          {{ book.record.totalPages }} pages
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { BookOpen, Sparkles, Play, Pencil } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'

defineProps({
  book: { type: Object, required: true },
  reason: { type: String, required: true },
  languageColor: { type: String, default: null },
})

defineEmits(['move-to-reading', 'edit'])
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
