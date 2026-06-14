import { ref, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://dyhipotqmnfylpigffiq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5aGlwb3RxbW5meWxwaWdmZmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MDk5ODAsImV4cCI6MjA5Njk4NTk4MH0.282sR2tpkTwnh5emDk72coOaQTIbVV0O-gh28-FDoY4'
)

const defaultLanguages = [
  { id: 'english', name: 'English', color: '#3b82f6', types: ['reading'] },
  { id: 'german', name: 'German', color: '#f59e0b', types: ['reading', 'grammar', 'vocabulary'] }
]

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

export function useStorage() {
  const data = ref({ languages: [], entries: [] })
  const loaded = ref(false)

  onMounted(async () => {
    const [langRes, entryRes] = await Promise.all([
      supabase.from('languages').select('*').order('id'),
      supabase.from('entries').select('*').order('date', { ascending: false })
    ])

    let languages = langRes.data || []
    if (languages.length === 0) {
      for (const lang of defaultLanguages) {
        await supabase.from('languages').upsert(lang)
      }
      languages = defaultLanguages
    }

    data.value = {
      languages,
      entries: (entryRes.data || []).map(toCamel)
    }
    loaded.value = true
  })

  const addEntry = async (entry) => {
    const newEntry = {
      ...entry,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2)
    }
    const { error } = await supabase.from('entries').insert(toSnake(newEntry))
    if (error) {
      console.error('Failed to add entry:', error)
      return
    }
    data.value.entries.push(newEntry)
  }

  const addLanguage = async (language) => {
    const newLang = {
      ...language,
      id: language.name.toLowerCase().replace(/\s+/g, '-')
    }
    const { error } = await supabase.from('languages').upsert(newLang)
    if (error) {
      console.error('Failed to add language:', error)
      return
    }
    if (!data.value.languages.find(l => l.id === newLang.id)) {
      data.value.languages.push(newLang)
    }
  }

  const deleteEntry = async (id) => {
    const { error } = await supabase.from('entries').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete entry:', error)
      return
    }
    data.value.entries = data.value.entries.filter(e => e.id !== id)
  }

  return {
    data,
    loaded,
    addEntry,
    addLanguage,
    deleteEntry
  }
}
