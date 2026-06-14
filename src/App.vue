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
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">Garten</h1>
        <p class="text-gray-600">Cultivate your language learning habits, one day at a time.</p>
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

      <!-- Language Manager -->
      <LanguageManager
        :languages="data.languages"
        @add-language="addLanguage"
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
      <div class="flex flex-col lg:flex-row gap-6 mt-6">
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
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: getLanguageColor(entry.languageId) }"
              ></div>
              <div>
                <span class="font-medium text-gray-700">{{ getLanguageName(entry.languageId) }}</span>
                <span class="text-gray-500 mx-2">{{ entry.type }}</span>
                <span class="text-sm text-gray-400">{{ entry.date }}</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600">
                {{ entry.hours }}h {{ entry.minutes }}m
              </span>
              <button
                @click="deleteEntry(entry.id)"
                class="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </div>
          </div>

          <div v-if="recentEntries.length === 0" class="text-center py-8 text-gray-400">
            No sessions yet. Start planting your first seed!
          </div>
        </div>
      </div>
    </div>
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
