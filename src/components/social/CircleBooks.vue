<template>
  <div class="space-y-5">
    <!-- Empty / no friends guard -->
    <div v-if="!friends.length" class="text-center py-8 text-stone-400">
      <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50" />
      <p class="text-sm">Add friends to see what they're reading.</p>
    </div>

    <div v-else-if="!booksByFriend.length" class="text-center py-8 text-stone-400">
      <BookOpen class="w-10 h-10 mx-auto mb-3 opacity-50" />
      <p class="text-sm">No books being shared right now.</p>
    </div>

    <!-- Grouped by friend -->
    <div v-for="group in booksByFriend" :key="group.friendId" class="gp-card gp-pad space-y-3">
      <div class="flex items-center gap-2.5 pb-2 border-b border-line">
        <div class="w-8 h-8 rounded-full bg-garden-100 text-garden-700 flex items-center justify-center text-xs font-bold">
          {{ initials(group.friendName) }}
        </div>
        <div>
          <h3 class="text-sm font-semibold text-stone-800">{{ group.friendName }}</h3>
          <p class="text-xs text-stone-500">
            {{ readingCount(group.books) }} reading · {{ readCount(group.books) }} read
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          v-for="book in group.books"
          :key="book.book_id"
          class="flex gap-3 p-2.5 rounded-xl border border-line bg-white/60 hover:bg-white hover:shadow-card transition-all"
        >
          <div class="w-14 h-20 flex-shrink-0 rounded-md overflow-hidden bg-stone-100 border border-line flex items-center justify-center">
            <img v-if="book.cover_url" :src="book.cover_url" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
            <BookOpen v-else :size="18" class="text-stone-300" />
          </div>

          <div class="flex flex-col min-w-0 flex-1">
            <h4 class="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">{{ book.title }}</h4>
            <p v-if="book.author" class="text-xs text-stone-500 truncate mt-0.5">{{ book.author }}</p>

            <div class="flex flex-wrap items-center gap-1.5 mt-2">
              <span class="text-[11px] font-medium text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full">
                {{ nameForCode(book.language_code) }}
              </span>
              <span class="text-[11px] font-medium px-2 py-0.5 rounded-full" :class="statusClass(book.status)">
                {{ STATUS_LABELS[book.status] || book.status }}
              </span>
              <span v-if="book.difficulty" class="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full capitalize">
                {{ book.difficulty }}
              </span>
            </div>

            <div class="mt-auto pt-2">
              <div v-if="book.total_pages" class="flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="book.status === 'read' ? 'bg-garden-500' : 'bg-orange-500'"
                    :style="{ width: book.progressPct + '%' }"
                  ></div>
                </div>
                <span class="text-[11px] text-stone-500 tabular-nums whitespace-nowrap">
                  {{ book.status === 'read' ? 'Done' : `${book.progressPct}%` }}
                </span>
              </div>
              <p v-if="book.total_pages" class="text-[11px] text-stone-400 mt-1 tabular-nums">
                {{ progressText(book) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import { nameForCode } from '../../lib/bookLanguages.js'
import { STATUS_LABELS } from '../../lib/readingStats.js'

const props = defineProps({
  friendBooks: { type: Array, default: () => [] },
  friends: { type: Array, default: () => [] },
})

const booksByFriend = computed(() => {
  const map = new Map()
  for (const book of props.friendBooks) {
    const id = book.friend_id
    if (!map.has(id)) {
      map.set(id, {
        friendId: id,
        friendName: book.friendName,
        books: [],
      })
    }
    map.get(id).books.push(book)
  }
  return Array.from(map.values())
})

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function readingCount(books) {
  return books.filter((b) => b.status === 'reading').length
}

function readCount(books) {
  return books.filter((b) => b.status === 'read').length
}

function statusClass(status) {
  switch (status) {
    case 'read':
      return 'text-garden-700 bg-garden-100'
    case 'reading':
      return 'text-orange-700 bg-orange-50'
    default:
      return 'text-stone-600 bg-stone-100'
  }
}

function progressText(book) {
  if (!book.total_pages) return ''
  if (book.status === 'read') return `${book.total_pages} pages`
  return `Page ${book.current_page || 0} of ${book.total_pages} · ${book.pagesLeft} left`
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
