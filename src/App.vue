<template>
  <div v-if="authLoading" class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <div class="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-gray-500">Loading your garden...</p>
    </div>
  </div>
  <AuthScreen v-else-if="!user" />
  <LanguageSetup
    v-else-if="setupActive"
    :languages="data.languages"
    @add-language="addLanguage"
    @done="finishSetup"
  />
  <div v-else class="min-h-screen bg-gray-50">
    <div v-if="!loaded" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500">Loading your garden...</p>
      </div>
    </div>
    <div v-else class="max-w-6xl mx-auto px-4 py-8">
      <!-- Garden Status Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">Garten</h1>
            <p class="text-sm sm:text-base text-gray-600">Cultivate your language learning habits, one day at a time.</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="signOut"
              class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              title="Sign Out"
            >
              Sign out
            </button>
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
        </div>

        <div class="flex items-center gap-3 mb-4">
          <span v-if="todayStreak > 0"
            class="inline-flex items-center gap-1 text-sm font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full"
          >
            {{ todayStreak }} day streak
          </span>
          <span class="text-sm text-gray-500">
            {{ todayMinutes > 0 ? `${todayMinutes}m studied today` : 'Ready to plant today\'s seed?' }}
          </span>
        </div>

        <!-- Weekly Goal -->
        <div v-if="goalHours" class="mb-4">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs text-gray-500">Weekly goal</span>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-medium text-gray-700">
                {{ (weekMinutes / 60).toFixed(1) }}h / {{ goalHours }}h
              </span>
              <button @click="goalEditing = !goalEditing" class="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
            </div>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
            <div v-for="(seg, i) in goalSegments" :key="i"
              class="h-2 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              :style="{ width: seg.percent + '%', backgroundColor: seg.color }"
            ></div>
          </div>
          <div v-if="goalProgress >= 100" class="text-xs text-green-600 mt-1 font-medium">Goal reached!</div>
        </div>
        <div v-else class="mb-4">
          <button @click="goalEditing = true" class="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            + Set weekly goal
          </button>
        </div>

        <!-- Goal Edit Inline -->
        <div v-if="goalEditing" class="mb-4 flex items-center gap-2">
          <input v-model.number="goalHours" type="number" min="0.5" step="0.5" placeholder="e.g. 5"
            class="w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span class="text-xs text-gray-500">hours/week</span>
          <button @click="saveGoalInput" class="text-xs text-green-600 hover:text-green-700 font-medium">Save</button>
          <button @click="goalEditing = false; goalHours = weeklyGoal" class="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>

        <LogForm
          :languages="data.languages"
          @add-entry="addEntry"
        />
      </div>

      <!-- Stats -->
      <StatsCard
        :entries="filteredEntries"
        :languages="data.languages"
        :filter="activeFilter"
      />

      <!-- Filters -->
      <FilterBar
        :languages="data.languages"
        @filter-change="updateFilter"
      />

      <!-- Heatmap + Leaderboard -->
      <div class="flex flex-col lg:flex-row lg:items-start gap-6">
        <div class="flex-1 min-w-0">
          <TimeframeSelector
            :view-mode="viewMode"
            :view-date="viewDate"
            @mode-change="updateViewMode"
            @navigate="navigateView"
          />
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
            class="p-3 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: getLanguageColor(entry.languageId) }"
              ></div>
              <span class="font-medium text-gray-700 text-sm">{{ getLanguageName(entry.languageId) }}</span>
              <span class="text-gray-400 text-xs">·</span>
              <span class="text-gray-500 text-xs capitalize">{{ entry.type }}</span>
              <span class="text-gray-400 text-xs">·</span>
              <span class="text-gray-400 text-xs">{{ entry.date }}</span>
              <span class="text-sm font-medium text-gray-600 ml-auto mr-2">
                {{ entry.hours }}h {{ entry.minutes }}m
              </span>
            </div>
            <div class="flex items-center gap-3 mt-1.5 pl-5">
              <p v-if="entry.notes" class="text-xs text-gray-400 truncate flex-1">{{ entry.notes }}</p>
              <div class="flex items-center gap-2 ml-auto flex-shrink-0">
                <button @click="openEdit(entry)" class="text-gray-400 hover:text-gray-600 text-xs">Edit</button>
                <button @click="confirmDeleteEntry(entry)" class="text-red-400 hover:text-red-600 text-xs">Delete</button>
              </div>
            </div>
          </div>

          <div v-if="recentEntries.length === 0" class="text-center py-8 text-gray-400">
            No sessions yet. Start planting your first seed!
          </div>
          <button
            v-if="recentEntries.length < data.entries.length"
            @click="recentLimit += 10"
            class="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Show more
          </button>
        </div>
      </div>
    </div>

    <!-- Language Manager Modal -->
    <LanguageManager
      :languages="data.languages"
      :visible="showLangManager"
      @add-language="addLanguage"
      @delete-language="deleteLanguage"
      @close="showLangManager = false"
    />

    <EditSession
      :entry="editingEntry"
      :languages="data.languages"
      :visible="editingVisible"
      @save="saveEdit"
      @close="editingVisible = false; editingEntry = null"
    />

    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="Delete session?"
      message="This will permanently remove this logged session. This cannot be undone."
      confirm-label="Delete"
      danger
      @confirm="executeDelete"
      @cancel="cancelDelete"
    />

    <Toast />
  </div>
</template>

<script setup>
import { ref, computed, watch, provide } from 'vue'
import { useAuth } from './composables/useAuth.js'
import { useStorage } from './composables/useStorage.js'
import { localDateStr } from './lib/date.js'
import AuthScreen from './components/AuthScreen.vue'
import LanguageSetup from './components/LanguageSetup.vue'
import LogForm from './components/LogForm.vue'
import StatsCard from './components/StatsCard.vue'
import LanguageManager from './components/LanguageManager.vue'
import FilterBar from './components/FilterBar.vue'
import TimeframeSelector from './components/TimeframeSelector.vue'
import Heatmap from './components/Heatmap.vue'
import InsightCard from './components/InsightCard.vue'
import Leaderboard from './components/Leaderboard.vue'
import EditSession from './components/EditSession.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import Toast from './components/Toast.vue'

const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
provide('auth', { signIn, signUp })

const { data, loaded, weeklyGoal, addEntry: storageAddEntry, addLanguage: storageAddLanguage, deleteLanguage: storageDeleteLanguage, deleteEntry: storageDeleteEntry, updateEntry: storageUpdateEntry, saveGoal } = useStorage()

const setupActive = ref(false)

watch([loaded, data], () => {
  if (loaded.value && data.value.languages.length === 0 && data.value.entries.length === 0) {
    setupActive.value = true
  }
})

const finishSetup = () => {
  setupActive.value = false
}

const activeFilter = ref({ language: null, types: [] })
const viewMode = ref('month')
const viewDate = ref(new Date())
const showLangManager = ref(false)
const editingEntry = ref(null)
const editingVisible = ref(false)
const deleteTarget = ref(null)
const showDeleteConfirm = ref(false)

const filteredEntries = computed(() => {
  return data.value.entries.filter(entry => {
    if (activeFilter.value.language && entry.languageId !== activeFilter.value.language) return false
    if (activeFilter.value.types.length > 0 && !activeFilter.value.types.includes(entry.type)) return false
    return true
  })
})

const recentLimit = ref(10)
const recentEntries = computed(() => {
  return [...data.value.entries]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, recentLimit.value)
})

const todayStreak = computed(() => {
  if (data.value.entries.length === 0) return 0
  const sortedDates = [...new Set(data.value.entries.map(e => e.date))].sort().reverse()
  let streak = 0
  let checkDate = new Date()
  for (const dateStr of sortedDates) {
    const entryDate = new Date(dateStr)
    const diffDays = Math.floor((checkDate - entryDate) / (1000 * 60 * 60 * 24))
    if (diffDays === streak) {
      streak++
    } else if (diffDays > streak) {
      break
    }
  }
  return streak
})

const todayMinutes = computed(() => {
  const today = localDateStr(new Date())
  const todayEntries = data.value.entries.filter(e => e.date === today)
  return todayEntries.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0)
})

const weekMinutes = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const from = localDateStr(monday)
  const to = localDateStr(sunday)
  return data.value.entries
    .filter(e => e.date >= from && e.date <= to)
    .reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0)
})

const goalHours = ref(null)
const goalEditing = ref(false)

watch(weeklyGoal, (v) => { goalHours.value = v }, { immediate: true })

const goalProgress = computed(() => {
  if (!goalHours.value || goalHours.value <= 0) return 0
  return Math.min((weekMinutes.value / (goalHours.value * 60)) * 100, 100)
})

const goalSegments = computed(() => {
  if (!goalHours.value || goalHours.value <= 0 || weekMinutes.value === 0) return []
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const from = localDateStr(monday)
  const to = localDateStr(sunday)

  const weekEntries = data.value.entries.filter(e => e.date >= from && e.date <= to)
  const byLang = {}
  for (const e of weekEntries) {
    byLang[e.languageId] = (byLang[e.languageId] || 0) + e.hours * 60 + e.minutes
  }

  const total = Object.values(byLang).reduce((s, v) => s + v, 0)
  const filledPct = Math.min((total / (goalHours.value * 60)) * 100, 100)

  return Object.entries(byLang)
    .sort((a, b) => b[1] - a[1])
    .map(([langId, mins]) => {
      const lang = data.value.languages.find(l => l.id === langId)
      return {
        color: lang ? lang.color : '#16a34a',
        percent: (mins / total) * filledPct
      }
    })
})

const saveGoalInput = () => {
  const val = parseFloat(goalHours.value)
  if (!val || val <= 0) { saveGoal(null); goalEditing.value = false; return }
  saveGoal(val)
  goalEditing.value = false
}

const updateFilter = (filter) => {
  activeFilter.value = filter
}

const updateViewMode = (mode) => {
  viewMode.value = mode
  viewDate.value = new Date()
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
const deleteLanguage = (langId) => { storageDeleteLanguage(langId) }
const deleteEntry = (id) => { storageDeleteEntry(id) }
const openEdit = (entry) => { editingEntry.value = entry; editingVisible.value = true }
const saveEdit = (entry) => { storageUpdateEntry(entry); editingVisible.value = false; editingEntry.value = null }

const confirmDeleteEntry = (entry) => { deleteTarget.value = entry; showDeleteConfirm.value = true }
const cancelDelete = () => { deleteTarget.value = null; showDeleteConfirm.value = false }
const executeDelete = () => { if (deleteTarget.value) storageDeleteEntry(deleteTarget.value.id); deleteTarget.value = null; showDeleteConfirm.value = false }

const getLanguageName = (languageId) => {
  const lang = data.value.languages.find(l => l.id === languageId)
  return lang ? lang.name : languageId
}

const getLanguageColor = (languageId) => {
  const lang = data.value.languages.find(l => l.id === languageId)
  return lang ? lang.color : '#16a34a'
}
</script>
