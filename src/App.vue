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
      <!-- Mode toggle: My Garden / Library / Friends -->
      <div class="flex justify-center mb-6 animate-fade-up">
        <div class="inline-flex w-full sm:w-auto items-center gap-1 p-1 rounded-full bg-white/80 backdrop-blur border border-line shadow-pill">
          <button
            @click="navView = 'garden'"
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200"
            :class="navView === 'garden' ? 'bg-gradient-to-b from-garden-500 to-garden-600 text-white shadow-[0_6px_14px_-8px_rgba(32,96,53,0.8)]' : 'text-stone-500 hover:text-stone-700'"
          >
            <Sprout :size="15" /> My Garden
          </button>
          <button
            @click="navView = 'library'"
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200"
            :class="navView === 'library' ? 'bg-gradient-to-b from-garden-500 to-garden-600 text-white shadow-[0_6px_14px_-8px_rgba(32,96,53,0.8)]' : 'text-stone-500 hover:text-stone-700'"
          >
            <BookOpen :size="15" /> Library
          </button>
          <button
            @click="navView = 'friends'"
            class="relative flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200"
            :class="navView === 'friends' ? 'bg-gradient-to-b from-garden-500 to-garden-600 text-white shadow-[0_6px_14px_-8px_rgba(32,96,53,0.8)]' : 'text-stone-500 hover:text-stone-700'"
          >
            <Users :size="15" /> Friends
            <!-- Pending friend requests wait inside the Friends view -->
            <span
              v-if="social.incomingRequests.value.length > 0 && navView !== 'friends'"
              class="absolute top-0.5 right-1 w-2 h-2 rounded-full bg-garden-500"
            ></span>
          </button>
        </div>
      </div>

      <template v-if="navView === 'garden'">
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
          <!-- Account menu: identity + the chrome that used to crowd the header -->
          <div class="relative flex-shrink-0" ref="userMenuRef">
            <button
              @click="userMenuOpen = !userMenuOpen"
              class="relative flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 bg-white border border-line hover:border-stone-300 hover:shadow-pill transition-all"
              :title="userEmail"
              aria-label="Account menu"
            >
              <BloomAvatar :seed="user?.id" :hours="totalLoggedHours" :variant="social.profile.value?.avatar_variant ?? null" :size="32" />
              <ChevronDown :size="14" class="text-stone-400 transition-transform" :class="{ 'rotate-180': userMenuOpen }" />
            </button>

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1 scale-95"
              enter-to-class="opacity-100 translate-y-0 scale-100"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="userMenuOpen"
                class="absolute right-0 mt-2 w-56 gp-card shadow-card p-1.5 z-40 origin-top-right"
              >
                <div class="px-2.5 py-1.5">
                  <div class="text-[10px] uppercase tracking-wider text-stone-400">Signed in as</div>
                  <div class="text-sm font-medium text-stone-700 truncate">{{ userEmail }}</div>
                </div>
                <div class="h-px bg-line my-1"></div>
                <button @click="openProfile" class="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                  <User :size="16" class="text-stone-400" />
                  My profile
                </button>
                <button @click="openLangManager" class="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                  <Settings :size="16" class="text-stone-400" />
                  Manage languages
                </button>
                <div class="h-px bg-line my-1"></div>
                <button @click="signOutFromMenu" class="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-colors">
                  <LogOut :size="16" class="text-stone-400" />
                  Sign out
                </button>
              </div>
            </Transition>
          </div>
        </div>

        <div v-if="todayStreak > 0 || todayMinutes > 0" class="flex items-center gap-3 mb-3">
          <span v-if="todayStreak > 0"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 ring-1 ring-orange-100 px-2.5 py-1 rounded-full"
          >
            <Flame :size="14" class="fill-orange-500/20" />
            {{ todayStreak }} day streak
          </span>
          <span v-if="todayMinutes > 0" class="text-sm text-stone-500">
            {{ todayMinutes }}m tended today
          </span>
        </div>

        <!-- Today's seed: one gentle next-best-action, computed from the data -->
        <div
          class="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border text-sm animate-fade-up"
          :class="nextActionUi.classes"
        >
          <component :is="nextActionUi.icon" :size="15" class="flex-shrink-0" />
          <span>{{ nextAction.message }}</span>
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
              :title="`${seg.name} · ${(seg.minutes / 60).toFixed(1)}h`"
              :aria-label="`${seg.name}: ${(seg.minutes / 60).toFixed(1)} hours`"
            ></div>
          </div>
          <!-- text legend so the split isn't conveyed by colour alone -->
          <div v-if="goalSegments.length > 1" class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            <span v-for="(seg, i) in goalSegments" :key="i" class="inline-flex items-center gap-1 text-[10px] text-stone-500">
              <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: seg.color }"></span>
              {{ seg.name }}
            </span>
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

      <!-- Analytics — tabbed so the page stays calm instead of a long stack -->
      <div class="mb-6">
        <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-stone-100/80 border border-line mb-4">
          <button
            v-for="t in analyticsTabs"
            :key="t.key"
            @click="analyticsTab = t.key"
            class="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
            :class="analyticsTab === t.key ? 'bg-white text-garden-700 shadow-pill' : 'text-stone-500 hover:text-stone-700'"
          >
            {{ t.label }}
          </button>
        </div>
        <div :key="analyticsTab" class="animate-fade-up">
          <InsightCard
            v-if="analyticsTab === 'insights'"
            :entries="filteredEntries"
            :languages="data.languages"
            :view-mode="viewMode"
            :view-date="viewDate"
          />
          <ActivityBreakdown
            v-else-if="analyticsTab === 'activity'"
            :entries="filteredEntries"
            :languages="data.languages"
          />
          <ActivityGoals
            v-else-if="analyticsTab === 'goals'"
            :rows="activityGoalRows"
            @set-goal="setActivityGoal"
            @clear-goal="clearActivityGoal"
          />
          <FluencyHorizon
            v-else
            :entries="data.entries"
            :languages="data.languages"
            :native-language="nativeLanguage"
            @manage="showLangManager = true"
          />
        </div>
      </div>

      <!-- Recent Sessions -->
      <div class="gp-card gp-pad mt-6 animate-fade-up">
        <h3 class="gp-title text-lg mb-4">Recent sessions</h3>

        <div v-if="groupedRecentEntries.length" class="space-y-5">
          <div v-for="group in groupedRecentEntries" :key="group.date">
            <!-- Day header -->
            <div class="flex items-baseline gap-2 pb-2 mb-2 border-b border-line">
              <span class="text-xs font-semibold uppercase tracking-wide text-stone-500">{{ group.label }}</span>
              <span class="text-xs text-stone-300">·</span>
              <span class="text-xs font-medium text-stone-400 tabular-nums">{{ group.totalFormatted }}</span>
            </div>

            <!-- Day sessions -->
            <div class="space-y-1.5">
              <div
                v-for="entry in group.entries"
                :key="entry.id"
                class="group relative flex flex-col rounded-xl bg-stone-50/70 hover:bg-stone-100/70 transition-colors pl-4 pr-3 py-2.5 overflow-hidden"
              >
                <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  :style="{ backgroundColor: getLanguageColor(entry.languageId) }"
                ></div>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-stone-700 text-sm truncate">{{ getLanguageName(entry.languageId) }}</span>
                  <span class="text-stone-300 text-xs">·</span>
                  <span class="text-stone-500 text-xs capitalize">{{ entry.type }}</span>
                  <span class="text-sm font-semibold text-stone-600 ml-auto tabular-nums">
                    {{ fmtMinutes(entry.hours * 60 + entry.minutes) }}
                  </span>
                </div>
                <div class="flex items-center gap-3 mt-1">
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
            </div>
          </div>

          <button
            v-if="recentEntries.length < data.entries.length"
            @click="recentLimit += 10"
            class="w-full py-2.5 text-sm font-medium text-stone-500 hover:text-garden-600 transition-colors"
          >
            Show more
          </button>
        </div>

        <div v-else class="text-center py-10 text-stone-400">
          <SproutIcon class="w-12 h-12 mx-auto mb-3 opacity-50 animate-sway" />
          <p class="text-sm">No sessions yet — plant your first seed above.</p>
        </div>
      </div>
      </template>

      <LibraryView v-else-if="navView === 'library'" :languages="data.languages" />

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

    <GardenerProfile
      mode="self"
      :visible="showProfile"
      :self="selfProfileInput"
      @close="showProfile = false"
      @save-bio="saveBio"
      @save-variant="saveVariant"
      @go-to-friends="showProfile = false; navView = 'friends'"
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
import { ref, computed, watch, provide, onMounted, onBeforeUnmount } from 'vue'
import { Settings, Pencil, Trash2, Sprout, Users, Flame, ChevronDown, LogOut, BookOpen, User, Target, Droplets } from 'lucide-vue-next'
import { useAuth } from './composables/useAuth.js'
import { useStorage } from './composables/useStorage.js'
import { useToast } from './composables/useToast.js'
import { useLanguageLookup } from './composables/useLanguageLookup.js'
import { useTimeframe } from './composables/useTimeframe.js'
import { useWeeklyGoal } from './composables/useWeeklyGoal.js'
import { useActivityGoals } from './composables/useActivityGoals.js'
import { localDateStr, currentStreak, getMonthRange, getQuarterRange, getYearRange } from './lib/date.js'
import { levelForHours } from './lib/proficiency.js'
import { computeNextAction } from './lib/nextAction.js'
import { detectMilestone } from './lib/milestones.js'
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
import ActivityGoals from './components/ActivityGoals.vue'
import Leaderboard from './components/Leaderboard.vue'
import EditSession from './components/EditSession.vue'
import SproutIcon from './components/SproutIcon.vue'
import BloomAvatar from './components/BloomAvatar.vue'
import GardenerProfile from './components/GardenerProfile.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import Toast from './components/Toast.vue'
import SocialView from './components/social/SocialView.vue'
import LibraryView from './components/library/LibraryView.vue'
import { useSocial } from './composables/useSocial.js'

const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth()
provide('auth', { signIn, signUp, resetPassword })
const toast = useToast()

const social = useSocial()
provide('social', social)
// Top-level view: 'garden' | 'library' | 'friends'. Persisted; migrates the
// previous boolean 'garten:socialMode' key on first load so existing users who
// were on the Friends tab stay there. (Named navView to avoid colliding with
// useTimeframe's heatmap `viewMode`.)
const NAV_VIEW_KEY = 'garten:viewMode'
const navView = ref(
  localStorage.getItem(NAV_VIEW_KEY) ||
  (localStorage.getItem('garten:socialMode') === 'true' ? 'friends' : 'garden')
)
watch(navView, (val) => localStorage.setItem(NAV_VIEW_KEY, val))

// Account menu — consolidates identity, language management and sign-out so
// the header carries motivation + action, not a button cluster.
const userMenuOpen = ref(false)
const userMenuRef = ref(null)
const userEmail = computed(() => user.value?.email || '')
// Drives the header avatar's growth stage — logged hours only (no prior-hours
// credit): the plant reflects the garden tended here.
const totalLoggedHours = computed(() =>
  data.value.entries.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0) / 60
)

function openLangManager() {
  userMenuOpen.value = false
  showLangManager.value = true
}
// My profile — a personal garden dashboard. Ensure the (cheap) profile row is
// loaded so name/handle/bio/bloom appear even if the Friends view was never
// opened this session; this fetches only the single profiles row, not the
// whole social layer.
const showProfile = ref(false)
function openProfile() {
  userMenuOpen.value = false
  if (!social.profileLoaded.value) social.loadProfile()
  showProfile.value = true
}
function saveBio(bio) {
  if (social.profile.value) social.updateProfile({ bio: bio || null })
}
function saveVariant(variant) {
  if (social.profile.value) social.updateProfile({ avatar_variant: variant })
}
function signOutFromMenu() {
  userMenuOpen.value = false
  signOut()
}
function onUserMenuDocClick(e) {
  if (userMenuOpen.value && userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    userMenuOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onUserMenuDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onUserMenuDocClick))

// Analytics tabs keep Insights / Activity / Goals / Horizon to one panel at a time.
const analyticsTab = ref('insights')
const analyticsTabs = [
  { key: 'insights', label: 'Insights' },
  { key: 'activity', label: 'Activity' },
  { key: 'goals', label: 'Goals' },
  { key: 'horizon', label: 'Horizon' },
]

const { data, loaded, loadError, weeklyGoal, nativeLanguage, activityGoals, addEntry: storageAddEntry, addLanguage: storageAddLanguage, deleteLanguage: storageDeleteLanguage, deleteEntry: storageDeleteEntry, updateEntry: storageUpdateEntry, updateLanguage: storageUpdateLanguage, saveGoal, saveActivityGoals, saveNativeLanguage, retryLoad } = useStorage()

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

const fmtMinutes = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const relativeDayLabel = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date(localDateStr(new Date()) + 'T00:00:00')
  const diffDays = Math.round((today - date) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const groupedRecentEntries = computed(() => {
  const groups = []
  const byDate = new Map()
  for (const entry of recentEntries.value) {
    let group = byDate.get(entry.date)
    if (!group) {
      group = { date: entry.date, label: relativeDayLabel(entry.date), totalMinutes: 0, totalFormatted: '', entries: [] }
      byDate.set(entry.date, group)
      groups.push(group)
    }
    group.entries.push(entry)
    group.totalMinutes += entry.hours * 60 + entry.minutes
  }
  for (const group of groups) group.totalFormatted = fmtMinutes(group.totalMinutes)
  return groups
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

// Everything the self-profile modal renders from — assembled here so it reads
// App.vue's single useStorage instance (rather than re-instantiating it) and
// stays live while the modal is open. Books are loaded lazily inside the modal.
const selfProfileInput = computed(() => ({
  userId: user.value?.id || '',
  email: user.value?.email || '',
  profile: social.profile.value,
  entries: data.value.entries,
  languages: data.value.languages,
  nativeLanguage: nativeLanguage.value,
  streak: todayStreak.value,
  weekMinutes: weekMinutes.value,
  goalHours: goalHours.value,
  totalHours: totalLoggedHours.value,
}))

const { rows: activityGoalRows, setGoal: setActivityGoal, clearGoal: clearActivityGoal } = useActivityGoals(
  computed(() => data.value.entries),
  computed(() => data.value.languages),
  activityGoals,
  saveActivityGoals
)

// "Today's seed" — the single next-best-action shown in the header card.
const nextAction = computed(() =>
  computeNextAction({
    entries: data.value.entries,
    languages: data.value.languages,
    todayMinutes: todayMinutes.value,
    weekMinutes: weekMinutes.value,
    goalHours: goalHours.value,
    activityRows: activityGoalRows.value,
  })
)
const NEXT_ACTION_TONES = {
  urgent: { icon: Flame, classes: 'bg-amber-50 border-amber-100 text-amber-700' },
  opportunity: { icon: Target, classes: 'bg-garden-50 border-garden-100 text-garden-700' },
  nudge: { icon: Target, classes: 'bg-amber-50 border-amber-100 text-amber-700' },
  gentle: { icon: Sprout, classes: 'bg-stone-50 border-line text-stone-600' },
  calm: { icon: Sprout, classes: 'bg-garden-50/60 border-garden-100 text-garden-700' },
}
const NEXT_ACTION_ICONS = { flame: Flame, target: Target, sprout: Sprout, droplets: Droplets }
const nextActionUi = computed(() => {
  const tone = NEXT_ACTION_TONES[nextAction.value.tone] || NEXT_ACTION_TONES.gentle
  return { icon: NEXT_ACTION_ICONS[nextAction.value.icon] || Sprout, classes: tone.classes }
})

const updateFilter = (filter) => {
  activeFilter.value = filter
}

// Snapshot of the milestone-relevant aggregates, taken before and after a log
// so we can detect a threshold the session just crossed. Logged hours per
// language exclude prior-hours credit; the CEFR level uses prior+logged.
function milestoneSnapshot() {
  const loggedByLang = {}
  for (const e of data.value.entries) {
    loggedByLang[e.languageId] = (loggedByLang[e.languageId] || 0) + e.hours * 60 + e.minutes
  }
  const langs = {}
  for (const l of data.value.languages) {
    const logged = (loggedByLang[l.id] || 0) / 60
    const total = (Number(l.prior_hours) || 0) + logged
    langs[l.id] = { name: l.name, hours: logged, level: levelForHours(l.name, total, nativeLanguage.value) }
  }
  return {
    streak: currentStreak(data.value.entries.map((e) => e.date)),
    weekReached: !!goalHours.value && weekMinutes.value >= goalHours.value * 60,
    langs,
  }
}

// Logging a session is the one moment stats should feed back: snapshot around
// the add, and if it pushed the user across a milestone, celebrate it quietly.
const addEntry = async (entry) => {
  const before = milestoneSnapshot()
  await storageAddEntry(entry)
  const milestone = detectMilestone(before, milestoneSnapshot())
  if (milestone) toast.show(milestone.message, 'celebrate', 6000)
}
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
