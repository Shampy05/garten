import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase.js'
import { getCached, setCache } from '../lib/cache.js'
import { useToast } from './useToast.js'
import { useAuth } from './useAuth.js'

function toSnake(entry) {
  return {
    id: entry.id,
    date: entry.date,
    language_id: entry.languageId,
    type: entry.type,
    hours: entry.hours,
    minutes: entry.minutes,
    notes: entry.notes || null
  }
}

function toCamel(row) {
  return {
    id: row.id,
    date: row.date,
    languageId: row.language_id,
    type: row.type,
    hours: row.hours,
    minutes: row.minutes,
    notes: row.notes || null
  }
}

function twoYearsAgo() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  return d.toISOString().split('T')[0]
}

export function useStorage() {
  const data = ref({ languages: [], entries: [] })
  const loaded = ref(false)
  const weeklyGoal = ref(null)
  const nativeLanguage = ref(null)
  const { userId } = useAuth()
  const toast = useToast()

  const loadData = async () => {
    if (!userId.value) {
      data.value = { languages: [], entries: [] }
      loaded.value = false
      return
    }

    const cached = getCached(userId.value)
    if (cached) {
      data.value = cached
      loaded.value = true
    } else {
      const [langRes, entryRes] = await Promise.all([
        supabase.from('languages').select('*').eq('user_id', userId.value).order('id'),
        supabase.from('entries').select('*').eq('user_id', userId.value).gte('date', twoYearsAgo()).order('date', { ascending: false })
      ])

      const fresh = {
        languages: langRes.data || [],
        entries: (entryRes.data || []).map(toCamel)
      }
      setCache(userId.value, fresh)
      data.value = fresh
      loaded.value = true
    }

    const { data: settings } = await supabase.from('user_settings').select('weekly_goal_hours, native_language').eq('user_id', userId.value).single()
    weeklyGoal.value = settings?.weekly_goal_hours ?? null
    nativeLanguage.value = settings?.native_language ?? null
  }

  // React to the shared auth singleton instead of opening a second
  // onAuthStateChange subscription. Fires immediately for the current session
  // and again whenever the signed-in user changes.
  watch(userId, (id) => {
    if (id) {
      loadData()
    } else {
      data.value = { languages: [], entries: [] }
      weeklyGoal.value = null
      nativeLanguage.value = null
      loaded.value = false
    }
  }, { immediate: true })

  const addEntry = async (entry) => {
    if (!userId.value) return

    const newEntry = {
      ...entry,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2)
    }
    const { error } = await supabase.from('entries').insert({
      ...toSnake(newEntry),
      user_id: userId.value
    })
    if (error) {
      toast.error('Failed to add entry. Please try again.')
      return
    }
    data.value.entries.push(newEntry)
    setCache(userId.value, data.value)
  }

  const addLanguage = async (language) => {
    if (!userId.value) return

    const newLang = {
      ...language,
      id: language.name.toLowerCase().replace(/\s+/g, '-'),
      user_id: userId.value
    }
    const { error } = await supabase.from('languages').upsert(newLang)
    if (error) {
      toast.error('Failed to add language. Please try again.')
      return
    }
    if (!data.value.languages.find(l => l.id === newLang.id)) {
      data.value.languages.push(newLang)
    }
    setCache(userId.value, data.value)
  }

  const deleteLanguage = async (langId) => {
    if (!userId.value) return

    await supabase.from('entries').delete().eq('language_id', langId).eq('user_id', userId.value)
    const { error } = await supabase.from('languages').delete().eq('id', langId).eq('user_id', userId.value)
    if (error) {
      toast.error('Failed to delete language. Please try again.')
      return
    }
    data.value.entries = data.value.entries.filter(e => e.languageId !== langId)
    data.value.languages = data.value.languages.filter(l => l.id !== langId)
    setCache(userId.value, data.value)
  }

  const updateLanguage = async (langId, updates) => {
    if (!userId.value) return

    const { error } = await supabase.from('languages').update(updates).eq('id', langId).eq('user_id', userId.value)
    if (error) {
      toast.error('Failed to update language. Please try again.')
      return
    }
    const idx = data.value.languages.findIndex(l => l.id === langId)
    if (idx !== -1) data.value.languages = data.value.languages.map(l => l.id === langId ? { ...l, ...updates } : l)
    setCache(userId.value, data.value)
  }

  const deleteEntry = async (id) => {
    if (!userId.value) return

    const { error } = await supabase.from('entries').delete().eq('id', id).eq('user_id', userId.value)
    if (error) {
      toast.error('Failed to delete entry. Please try again.')
      return
    }
    data.value.entries = data.value.entries.filter(e => e.id !== id)
    setCache(userId.value, data.value)
  }

  const updateEntry = async (entry) => {
    if (!userId.value) return

    const { error } = await supabase.from('entries').update(toSnake(entry)).eq('id', entry.id).eq('user_id', userId.value)
    if (error) {
      toast.error('Failed to update entry. Please try again.')
      return
    }
    const idx = data.value.entries.findIndex(e => e.id === entry.id)
    if (idx !== -1) data.value.entries[idx] = entry
    setCache(userId.value, data.value)
  }

  const saveGoal = async (hours) => {
    if (!userId.value) return

    const { error } = await supabase.from('user_settings').upsert({ user_id: userId.value, weekly_goal_hours: hours, updated_at: new Date().toISOString() })
    if (error) {
      toast.error('Failed to save goal. Please try again.')
      return
    }
    weeklyGoal.value = hours
  }

  const saveNativeLanguage = async (lang) => {
    if (!userId.value) return

    const value = lang || null
    const { error } = await supabase.from('user_settings').upsert({ user_id: userId.value, native_language: value, updated_at: new Date().toISOString() })
    if (error) {
      toast.error('Failed to save native language. Please try again.')
      return
    }
    nativeLanguage.value = value
  }

  return {
    data,
    loaded,
    weeklyGoal,
    nativeLanguage,
    addEntry,
    addLanguage,
    deleteLanguage,
    deleteEntry,
    updateEntry,
    updateLanguage,
    saveGoal,
    saveNativeLanguage
  }
}
