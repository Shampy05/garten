<template>
  <div class="min-h-screen bg-gray-50">
    <div v-if="!loaded" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500">Loading your garden...</p>
      </div>
    </div>
    <div v-else class="max-w-6xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="flex items-start justify-between mb-8">
        <div>
          <h1 class="text-4xl font-bold text-gray-900 mb-2">Garten</h1>
          <p class="text-gray-600">Cultivate your language learning habits, one day at a time.</p>
        </div>
        <button
          @click="showLangManager = !showLangManager"
          class="w-10 h-10 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all flex-shrink-0"
          title="Manage Languages"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>

      <!-- Log Form -->
      <LogForm
        :languages="data.languages"
        @add-entry="addEntry"
      />

      <!-- Stats -->
      <StatsCard
        :entries="filteredEntries"
        :filter="activeFilter"
      />

      <!-- Filters -->
      <FilterBar
        :languages="data.languages"
        @filter-change="updateFilter"
      />

      <!-- Timeframe Selector -->
      <TimeframeSelector
        :view-mode="viewMode"
        :view-date="viewDate"
        @mode-change="updateViewMode"
        @navigate="navigateView"
      />

      <!-- Heatmap + Leaderboard -->
      <div class="flex flex-col lg:flex-row lg:items-start gap-6 mt-6">
        <div class="flex-1 min-w-0">
          <Heatmap
            :entries="filteredEntries"
            :languages="data.languages"
            :filter="activeFilter"
            :view-mode="viewMode"
            :view-date="viewDate"
          />
        </div>
        <div class="w-full lg:w-56 flex-shrink-0">
          <Leaderboard
            :entries="data.entries"
            :languages="data.languages"
            :view-mode="viewMode"
            :view-date="viewDate"
          />
        </div>
      </div>

      <!-- Insights -->
      <InsightCard
        :entries="filteredEntries"
        :languages="data.languages"
        :view-mode="viewMode"
        :view-date="viewDate"
      />

      <!-- Recent Entries -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mt-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Recent Sessions</h3>
        <div class="space-y-2">
          <div
            v-for="entry in recentEntries"
            :key="entry.id"
            class="flex flex-wrap items-center gap-1 p-3 bg-gray-50 rounded-lg"
          >
            <div class="w-3 h-3 rounded-full flex-shrink-0"
              :style="{ backgroundColor: getLanguageColor(entry.languageId) }"
            ></div>
            <span class="font-medium text-gray-700 text-sm">{{ getLanguageName(entry.languageId) }}</span>
            <span class="text-gray-500 text-sm">{{ entry.type }}</span>
            <span class="text-xs text-gray-400">{{ entry.date }}</span>
            <span class="text-sm font-medium text-gray-600 ml-auto">
              {{ entry.hours }}h {{ entry.minutes }}m
            </span>
            <button
              @click="deleteEntry(entry.id)"
              class="text-red-500 hover:text-red-700 text-xs"
            >
              Delete
            </button>
          </div>

          <div v-if="recentEntries.length === 0" class="text-center py-8 text-gray-400">
            No sessions yet. Start planting your first seed!
          </div>
        </div>
      </div>
    </div>

    <!-- Language Manager Modal -->
    <LanguageManager
      :languages="data.languages"
      :visible="showLangManager"
      @add-language="addLanguage"
      @close="showLangManager = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStorage } from './composables/useStorage.js'
import LogForm from './components/LogForm.vue'
import StatsCard from './components/StatsCard.vue'
import LanguageManager from './components/LanguageManager.vue'
import FilterBar from './components/FilterBar.vue'
import TimeframeSelector from './components/TimeframeSelector.vue'
import Heatmap from './components/Heatmap.vue'
import InsightCard from './components/InsightCard.vue'
import Leaderboard from './components/Leaderboard.vue'

const { data, loaded, addEntry: storageAddEntry, addLanguage: storageAddLanguage, deleteEntry: storageDeleteEntry } = useStorage()

const activeFilter = ref({ language: null, types: [] })
const viewMode = ref('month')
const viewDate = ref(new Date())
const showLangManager = ref(false)

const filteredEntries = computed(() => {
  return data.value.entries.filter(entry => {
    if (activeFilter.value.language && entry.languageId !== activeFilter.value.language) return false
    if (activeFilter.value.types.length > 0 && !activeFilter.value.types.includes(entry.type)) return false
    return true
  })
})

const recentEntries = computed(() => {
  return [...data.value.entries]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
})

const updateFilter = (filter) => {
  activeFilter.value = filter
}

const updateViewMode = (mode) => {
  viewMode.value = mode
  viewDate.value = new Date() // Reset to current when changing mode
}

const navigateView = (direction) => {
  const d = new Date(viewDate.value)
  switch (viewMode.value) {
    case 'month':
      d.setMonth(d.getMonth() + direction)
      break
    case 'quarter':
      d.setMonth(d.getMonth() + direction * 3)
      break
    case 'year':
      d.setFullYear(d.getFullYear() + direction)
      break
  }
  viewDate.value = d
}

const addEntry = (entry) => { storageAddEntry(entry) }
const addLanguage = (language) => { storageAddLanguage(language) }
const deleteEntry = (id) => { storageDeleteEntry(id) }

const getLanguageName = (languageId) => {
  const lang = data.value.languages.find(l => l.id === languageId)
  return lang ? lang.name : languageId
}

const getLanguageColor = (languageId) => {
  const lang = data.value.languages.find(l => l.id === languageId)
  return lang ? lang.color : '#16a34a'
}
</script>
