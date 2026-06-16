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
        <div v-if="!loadError" class="text-center">
          <div class="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-500">Loading your garden...</p>
        </div>
        <div v-else>
          <p class="text-gray-500 mb-4">Failed to load your garden.</p>
          <button
            @click="retryLoad"
            class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
    <div v-else class="max-w-6xl mx-auto px-4 py-8">
      <!-- Garden Status Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <SproutIcon class="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
            <div>
              <h1 class="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-1">Garten</h1>
              <p class="text-sm sm:text-base text-gray-600">Track your language learning progress.</p>
            </div>
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
              <Settings :size="20" />
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
                <Pencil :size="12" />
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

      <!-- Filter (bare pills, no card shell) -->
      <FilterBar
        :languages="data.languages"
        @filter-change="updateFilter"
        class="mb-4"
      />

      <!-- Hero: Heatmap -->
      <div class="bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-8 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <TimeframeSelector
            class="flex-1"
            :view-mode="viewMode"
            :view-date="viewDate"
            @mode-change="updateViewMode"
            @navigate="navigateView"
          />
          <StatsCard
            :entries="filteredEntries"
            :filter="activeFilter"
            :view-mode="viewMode"
            :view-date="viewDate"
          />
        </div>
        <div class="flex flex-col lg:flex-row lg:items-start gap-6">
          <div class="flex-1 min-w-0">
            <Heatmap
              :entries="filteredEntries"
              :languages="data.languages"
              :filter="activeFilter"
              :view-mode="viewMode"
              :view-date="viewDate"
            />
          </div>
          <div class="w-full lg:w-48 flex-shrink-0">
            <Leaderboard
              :entries="data.entries"
              :languages="data.languages"
              :view-mode="viewMode"
              :view-date="viewDate"
            />
          </div>
        </div>
      </div>

      <!-- Analytics grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <InsightCard
          :entries="filteredEntries"
          :languages="data.languages"
          :view-mode="viewMode"
          :view-date="viewDate"
        />
        <ActivityBreakdown
          :entries="filteredEntries"
          :languages="data.languages"
        />
      </div>

      <!-- Fluency Horizon -->
      <FluencyHorizon
        :entries="data.entries"
        :languages="data.languages"
        :native-language="nativeLanguage"
        @manage="showLangManager = true"
      />

      <!-- Recent Sessions -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6 mt-6">
        <h3 class="font-display text-lg font-semibold text-gray-800 mb-4">Recent Sessions</h3>
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
              <div class="flex items-center gap-1.5 ml-auto flex-shrink-0">
                <button @click="openEdit(entry)" class="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors" title="Edit">
                  <Pencil :size="14" />
                </button>
                <button @click="confirmDeleteEntry(entry)" class="p-1 rounded text-red-400 hover:text-red-600 transition-colors" title="Delete">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="recentEntries.length === 0" class="text-center py-8 text-gray-400">
            <Sprout :size="32" class="mx-auto mb-3 text-gray-300" />
            <p class="text-sm">No sessions yet. Start planting your first seed!</p>
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
      :entries="data.entries"
      :weekly-goal="goalHours"
      :native-language="nativeLanguage"
      :visible="showLangManager"
      @add-language="addLanguage"
      @delete-language="deleteLanguage"
      @update-language="updateLanguage"
      @set-native-language="saveNativeLanguage"
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
import { Settings, Pencil, Trash2, Sprout } from 'lucide-vue-next'
import { useAuth } from './composables/useAuth.js'
import { useStorage } from './composables/useStorage.js'
import { useLanguageLookup } from './composables/useLanguageLookup.js'
import { useTimeframe } from './composables/useTimeframe.js'
import { useWeeklyGoal } from './composables/useWeeklyGoal.js'
import { localDateStr, currentStreak } from './lib/date.js'
import AuthScreen from './components/AuthScreen.vue'
import LanguageSetup from './components/LanguageSetup.vue'
import LogForm from './components/LogForm.vue'
import StatsCard from './components/StatsCard.vue'
import LanguageManager from './components/LanguageManager.vue'
import FilterBar from './components/FilterBar.vue'
import TimeframeSelector from './components/TimeframeSelector.vue'
import Heatmap from './components/Heatmap.vue'
import InsightCard from './components/InsightCard.vue'
import FluencyHorizon from './components/FluencyHorizon.vue'
import ActivityBreakdown from './components/ActivityBreakdown.vue'
import Leaderboard from './components/Leaderboard.vue'
import EditSession from './components/EditSession.vue'
import SproutIcon from './components/SproutIcon.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import Toast from './components/Toast.vue'

const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth()
provide('auth', { signIn, signUp, resetPassword })

const { data, loaded, loadError, weeklyGoal, nativeLanguage, addEntry: storageAddEntry, addLanguage: storageAddLanguage, deleteLanguage: storageDeleteLanguage, deleteEntry: storageDeleteEntry, updateEntry: storageUpdateEntry, updateLanguage: storageUpdateLanguage, saveGoal, saveNativeLanguage, retryLoad } = useStorage()

const { nameFor, colorFor } = useLanguageLookup(() => data.value.languages)

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
const { viewMode, viewDate, updateViewMode, navigateView } = useTimeframe()
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
    .sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date)
      if (dateDiff !== 0) return dateDiff
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
    .slice(0, recentLimit.value)
})

const todayStreak = computed(() => currentStreak(data.value.entries.map(e => e.date)))

const todayMinutes = computed(() => {
  const today = localDateStr(new Date())
  const todayEntries = data.value.entries.filter(e => e.date === today)
  return todayEntries.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0)
})

const { goalHours, goalEditing, weekMinutes, goalProgress, goalSegments, saveGoalInput } = useWeeklyGoal(
  computed(() => data.value.entries),
  computed(() => data.value.languages),
  weeklyGoal,
  saveGoal
)

const updateFilter = (filter) => {
  activeFilter.value = filter
}

const addEntry = (entry) => { storageAddEntry(entry) }
const addLanguage = (language) => { storageAddLanguage(language) }
const deleteLanguage = (langId) => { storageDeleteLanguage(langId) }
const updateLanguage = (data) => { const { id, ...updates } = data; storageUpdateLanguage(id, updates) }
const deleteEntry = (id) => { storageDeleteEntry(id) }
const openEdit = (entry) => { editingEntry.value = entry; editingVisible.value = true }
const saveEdit = (entry) => { storageUpdateEntry(entry); editingVisible.value = false; editingEntry.value = null }

const confirmDeleteEntry = (entry) => { deleteTarget.value = entry; showDeleteConfirm.value = true }
const cancelDelete = () => { deleteTarget.value = null; showDeleteConfirm.value = false }
const executeDelete = () => { if (deleteTarget.value) storageDeleteEntry(deleteTarget.value.id); deleteTarget.value = null; showDeleteConfirm.value = false }

const getLanguageName = nameFor
const getLanguageColor = colorFor
</script>
