<template>
  <div v-if="authLoading" class="min-h-screen flex items-center justify-center">
    <div class="text-center animate-fade-up">
      <SproutIcon class="w-12 h-12 mx-auto mb-4 animate-sway" />
      <p class="text-sm text-stone-500">Tending your garden…</p>
    </div>
  </div>
  <AuthScreen v-else-if="!user" />
  <LanguageSetup
    v-else-if="setupActive"
    :languages="data.languages"
    @add-language="addLanguage"
    @done="finishSetup"
  />
  <div v-else class="min-h-screen">
    <div v-if="!loaded" class="flex items-center justify-center min-h-screen">
      <div class="text-center animate-fade-up">
        <div v-if="!loadError">
          <SproutIcon class="w-12 h-12 mx-auto mb-4 animate-sway" />
          <p class="text-sm text-stone-500">Tending your garden…</p>
        </div>
        <div v-else class="gp-card gp-pad max-w-xs">
          <SproutIcon class="w-10 h-10 mx-auto mb-3 opacity-60" />
          <p class="text-stone-600 mb-4 text-sm">We couldn't reach your garden.</p>
          <button
            @click="retryLoad"
            class="gp-btn-primary px-5 py-2.5 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
    <div v-else class="max-w-6xl mx-auto px-4 py-8">
      <!-- Mode toggle: My Garden / Friends -->
      <div class="flex justify-center mb-6 animate-fade-up">
        <div class="inline-flex items-center gap-1 p-1 rounded-full bg-white/80 backdrop-blur border border-line shadow-pill">
          <button
            @click="socialMode = false"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
            :class="!socialMode ? 'bg-gradient-to-b from-garden-500 to-garden-600 text-white shadow-[0_6px_14px_-8px_rgba(32,96,53,0.8)]' : 'text-stone-500 hover:text-stone-700'"
          >
            <Sprout :size="15" /> My Garden
          </button>
          <button
            @click="socialMode = true"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
            :class="socialMode ? 'bg-gradient-to-b from-garden-500 to-garden-600 text-white shadow-[0_6px_14px_-8px_rgba(32,96,53,0.8)]' : 'text-stone-500 hover:text-stone-700'"
          >
            <Users :size="15" /> Friends
          </button>
        </div>
      </div>

      <template v-if="!socialMode">
      <!-- Garden Status Card -->
      <div class="gp-card gp-pad mb-6 relative overflow-hidden animate-grow-in">
        <!-- soft botanical wash along the top edge -->
        <div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-garden-50/80 to-transparent"></div>
        <div class="relative">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3 group">
            <SproutIcon class="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 transition-transform duration-500 group-hover:rotate-[-4deg] group-hover:scale-105" />
            <div>
              <h1 class="font-display text-3xl sm:text-4xl font-bold text-stone-900 mb-0.5 tracking-tight">Garten</h1>
              <p class="text-sm sm:text-base text-stone-500">Where your language learning grows.</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="signOut"
              class="text-xs text-stone-400 hover:text-stone-600 transition-colors"
              title="Sign Out"
            >
              Sign out
            </button>
            <button
              @click="showNotificationsPanel = true; social.markNotificationsRead()"
              class="gp-icon-btn relative w-10 h-10 flex-shrink-0"
              title="Notifications"
            >
              <Mail :size="20" />
              <span
                v-if="social.hasNotifications.value"
                class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium border-2 border-white"
              >
                {{ social.notificationCount.value > 9 ? '9+' : social.notificationCount.value }}
              </span>
            </button>
            <button
              @click="showLangManager = !showLangManager"
              class="gp-icon-btn w-10 h-10 flex-shrink-0"
              title="Manage Languages"
            >
              <Settings :size="20" />
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3 mb-4">
          <span v-if="todayStreak > 0"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 ring-1 ring-orange-100 px-2.5 py-1 rounded-full"
          >
            <Flame :size="14" class="fill-orange-500/20" />
            {{ todayStreak }} day streak
          </span>
          <span class="text-sm text-stone-500">
            {{ todayMinutes > 0 ? `${todayMinutes}m tended today` : 'Ready to plant today\'s seed?' }}
          </span>
        </div>

        <!-- Weekly Goal -->
        <div v-if="goalHours" class="mb-4">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-medium text-stone-500 uppercase tracking-wide">Weekly goal</span>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-semibold text-stone-700 tabular-nums">
                {{ (weekMinutes / 60).toFixed(1) }}h / {{ goalHours }}h
              </span>
              <button @click="goalEditing = !goalEditing" class="text-stone-400 hover:text-stone-600 transition-colors">
                <Pencil :size="12" />
              </button>
            </div>
          </div>
          <div class="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden flex ring-1 ring-inset ring-black/5">
            <div v-for="(seg, i) in goalSegments" :key="i"
              class="h-2.5 transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
              :style="{ width: seg.percent + '%', backgroundColor: seg.color }"
            ></div>
          </div>
          <div v-if="goalProgress >= 100" class="flex items-center gap-1 text-xs text-garden-600 mt-1.5 font-semibold animate-fade-up">
            <Sprout :size="13" /> Goal reached — lovely work!
          </div>
        </div>
        <div v-else class="mb-4">
          <button @click="goalEditing = true" class="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            + Set a weekly goal
          </button>
        </div>

        <!-- Goal Edit Inline -->
        <div v-if="goalEditing" class="mb-4 flex items-center gap-2">
          <input v-model.number="goalHours" type="number" min="0.5" step="0.5" placeholder="e.g. 5"
            class="gp-input w-24 py-1.5"
          />
          <span class="text-xs text-stone-500">hours/week</span>
          <button @click="saveGoalInput" class="text-xs text-garden-600 hover:text-garden-700 font-semibold">Save</button>
          <button @click="goalEditing = false; goalHours = weeklyGoal" class="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
        </div>

        <LogForm
          :languages="data.languages"
          @add-entry="addEntry"
        />
        </div>
      </div>

      <!-- Filter (bare pills, no card shell) -->
      <FilterBar
        :languages="data.languages"
        @filter-change="updateFilter"
        class="mb-4"
      />

      <!-- Hero: Heatmap -->
      <div class="gp-card shadow-hero gp-pad sm:p-8 mb-6 animate-fade-up">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <TimeframeSelector
            class="flex-1"
            :view-mode="viewMode"
            :view-date="viewDate"
            @mode-change="updateViewMode"
            @navigate="navigateView"
          />
          <div class="flex items-center gap-4 flex-shrink-0">
            <div>
              <div class="font-display text-xl font-bold text-stone-800 leading-none tabular-nums">{{ heroActiveDays }}</div>
              <div class="text-[10px] text-stone-400 uppercase tracking-wide mt-0.5">days</div>
            </div>
            <div class="w-px h-7 bg-line"></div>
            <div>
              <div class="font-display text-xl font-bold text-stone-800 leading-none tabular-nums">{{ heroHours }}h</div>
              <div class="text-[10px] text-stone-400 uppercase tracking-wide mt-0.5">logged</div>
            </div>
            <div class="w-px h-7 bg-line"></div>
            <div>
              <div class="font-display text-xl font-bold text-stone-800 leading-none tabular-nums">{{ heroSessions }}</div>
              <div class="text-[10px] text-stone-400 uppercase tracking-wide mt-0.5">sessions</div>
            </div>
          </div>
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
      <div class="gp-card gp-pad mt-6 animate-fade-up">
        <h3 class="gp-title text-lg mb-4">Recent Sessions</h3>
        <div class="space-y-2">
          <div
            v-for="entry in recentEntries"
            :key="entry.id"
            class="group p-3 rounded-xl bg-stone-50/70 border border-transparent hover:border-line hover:bg-white hover:shadow-pill transition-all duration-200"
          >
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                :style="{ backgroundColor: getLanguageColor(entry.languageId) }"
              ></div>
              <span class="font-semibold text-stone-700 text-sm">{{ getLanguageName(entry.languageId) }}</span>
              <span class="text-stone-300 text-xs">·</span>
              <span class="text-stone-500 text-xs capitalize">{{ entry.type }}</span>
              <span class="text-stone-300 text-xs">·</span>
              <span class="text-stone-400 text-xs tabular-nums">{{ entry.date }}</span>
              <span class="text-sm font-semibold text-stone-600 ml-auto mr-2 tabular-nums">
                {{ entry.hours }}h {{ entry.minutes }}m
              </span>
            </div>
            <div class="flex items-center gap-3 mt-1.5 pl-5">
              <p v-if="entry.notes" class="text-xs text-stone-400 truncate flex-1">{{ entry.notes }}</p>
              <div class="flex items-center gap-1 ml-auto flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button @click="openEdit(entry)" class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors" title="Edit">
                  <Pencil :size="14" />
                </button>
                <button @click="confirmDeleteEntry(entry)" class="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="recentEntries.length === 0" class="text-center py-10 text-stone-400">
            <SproutIcon class="w-12 h-12 mx-auto mb-3 opacity-50 animate-sway" />
            <p class="text-sm">No sessions yet — plant your first seed above.</p>
          </div>
          <button
            v-if="recentEntries.length < data.entries.length"
            @click="recentLimit += 10"
            class="w-full py-2.5 text-sm font-medium text-stone-500 hover:text-garden-600 transition-colors"
          >
            Show more
          </button>
        </div>
      </div>
      </template>

      <SocialView v-else :languages="data.languages" />
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

    <NotificationsPanel
      v-model="showNotificationsPanel"
      @open-event="openNotificationEvent"
    />

    <Toast />
  </div>
</template>

<script setup>
import { ref, computed, watch, provide } from 'vue'
import { Settings, Pencil, Trash2, Sprout, Users, Mail, Flame } from 'lucide-vue-next'
import { useAuth } from './composables/useAuth.js'
import { useStorage } from './composables/useStorage.js'
import { useLanguageLookup } from './composables/useLanguageLookup.js'
import { useTimeframe } from './composables/useTimeframe.js'
import { useWeeklyGoal } from './composables/useWeeklyGoal.js'
import { localDateStr, currentStreak, getMonthRange, getQuarterRange, getYearRange } from './lib/date.js'
import AuthScreen from './components/AuthScreen.vue'
import LanguageSetup from './components/LanguageSetup.vue'
import LogForm from './components/LogForm.vue'
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
import SocialView from './components/social/SocialView.vue'
import NotificationsPanel from './components/social/NotificationsPanel.vue'
import { useSocial } from './composables/useSocial.js'

const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth()
provide('auth', { signIn, signUp, resetPassword })

const social = useSocial()
provide('social', social)
const SOCIAL_MODE_KEY = 'garten:socialMode'
const socialMode = ref(localStorage.getItem(SOCIAL_MODE_KEY) === 'true')
watch(socialMode, (val) => localStorage.setItem(SOCIAL_MODE_KEY, String(val)))
const showNotificationsPanel = ref(false)

function openNotificationEvent(event) {
  showNotificationsPanel.value = false
  socialMode.value = true
  social.openEventDetail(event)
}

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

const heroPeriodRange = computed(() => {
  const d = viewDate.value
  let range
  switch (viewMode.value) {
    case 'month': range = getMonthRange(d); break
    case 'quarter': range = getQuarterRange(d); break
    case 'year': range = getYearRange(d); break
    default: range = getMonthRange(d)
  }
  return { start: localDateStr(range.start), end: localDateStr(range.end) }
})

const heroPeriodEntries = computed(() => {
  const { start, end } = heroPeriodRange.value
  return filteredEntries.value.filter(e => e.date >= start && e.date <= end)
})

const heroActiveDays = computed(() => new Set(heroPeriodEntries.value.map(e => e.date)).size)
const heroHours = computed(() =>
  (heroPeriodEntries.value.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0) / 60).toFixed(1)
)
const heroSessions = computed(() => heroPeriodEntries.value.length)

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
