import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase.js'
import { getCached, setCache, clearCache } from '../lib/cache.js'

function toSnake(entry) {
  return {
    id: entry.id,
    date: entry.date,
    language_id: entry.languageId,
    type: entry.type,
    hours: entry.hours,
    minutes: entry.minutes
  }
}

function toCamel(row) {
  return {
    id: row.id,
    date: row.date,
    languageId: row.language_id,
    type: row.type,
    hours: row.hours,
    minutes: row.minutes
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

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      data.value = { languages: [], entries: [] }
      loaded.value = false
      return
    }

    const cached = getCached(userId)
    if (cached) {
      data.value = cached
      loaded.value = true
      return
    }

    const [langRes, entryRes] = await Promise.all([
      supabase.from('languages').select('*').eq('user_id', userId).order('id'),
      supabase.from('entries').select('*').eq('user_id', userId).gte('date', twoYearsAgo()).order('date', { ascending: false })
    ])

    const fresh = {
      languages: langRes.data || [],
      entries: (entryRes.data || []).map(toCamel)
    }
    setCache(userId, fresh)
    data.value = fresh
    loaded.value = true
  }

  onMounted(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') loadData()
      else if (event === 'SIGNED_OUT') {
        data.value = { languages: [], entries: [] }
        loaded.value = false
      }
    })
    onUnmounted(() => subscription.unsubscribe())
  })

  const addEntry = async (entry) => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return

    const newEntry = {
      ...entry,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2)
    }
    const { error } = await supabase.from('entries').insert({
      ...toSnake(newEntry),
      user_id: userId
    })
    if (error) {
      console.error('Failed to add entry:', error)
      return
    }
    clearCache(userId)
    data.value.entries.push(newEntry)
  }

  const addLanguage = async (language) => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return

    const newLang = {
      ...language,
      id: language.name.toLowerCase().replace(/\s+/g, '-'),
      user_id: userId
    }
    const { error } = await supabase.from('languages').upsert(newLang)
    if (error) {
      console.error('Failed to add language:', error)
      return
    }
    clearCache(userId)
    if (!data.value.languages.find(l => l.id === newLang.id)) {
      data.value.languages.push(newLang)
    }
  }

  const deleteLanguage = async (langId) => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return

    await supabase.from('entries').delete().eq('language_id', langId).eq('user_id', userId)
    const { error } = await supabase.from('languages').delete().eq('id', langId).eq('user_id', userId)
    if (error) {
      console.error('Failed to delete language:', error)
      return
    }
    clearCache(userId)
    data.value.entries = data.value.entries.filter(e => e.languageId !== langId)
    data.value.languages = data.value.languages.filter(l => l.id !== langId)
  }

  const deleteEntry = async (id) => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return

    const { error } = await supabase.from('entries').delete().eq('id', id).eq('user_id', userId)
    if (error) {
      console.error('Failed to delete entry:', error)
      return
    }
    clearCache(userId)
    data.value.entries = data.value.entries.filter(e => e.id !== id)
  }

  return {
    data,
    loaded,
    addEntry,
    addLanguage,
    deleteLanguage,
    deleteEntry
  }
}
