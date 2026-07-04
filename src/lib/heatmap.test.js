import { describe, it, expect } from 'vitest'
import { groupActivitiesByLanguageId } from './heatmap.js'

// nameFor is the lookup's display-name resolver. We pass a tiny stand-in
// here so the test stays self-contained — the real lookup is exercised by
// useLanguageLookup.test.js. The mock defaults each id to its canonical
// name (capitalised) and lets nicknames override; this matches the real
// useLanguageLookup behaviour (nickname ?? canonical) so the grouping
// helper can be tested without spinning up the full lookup.
const nicknames = {
  spanish: 'Español',
  bengali: 'বাংলা',
  urdu: 'اردو',
}
const canonicals = {
  spanish: 'Spanish',
  german: 'German',
  bengali: 'Bengali',
  urdu: 'Urdu',
  french: 'French',
}
const nameFor = (id) => nicknames[id] || canonicals[id] || id

describe('groupActivitiesByLanguageId', () => {
  it('groups by id when the activity uses the canonical name (no nickname)', () => {
    // 'French' has no nickname, so its display label is the canonical
    // 'French'. The activity references the canonical, and the helper
    // should still resolve it to the id.
    const languages = [
      { id: 'french', name: 'French' },
      { id: 'german', name: 'German' },
    ]
    const activities = [
      { language: 'French', minutes: 30 },
      { language: 'German', minutes: 45 },
    ]
    expect(groupActivitiesByLanguageId(activities, languages, nameFor)).toEqual({
      french: 30,
      german: 45,
    })
  })

  it('groups by id when the activity uses the nickname — the regression', () => {
    // Before the fix, getLanguageActivities did
    // `languages.find(l => l.name === a.language)` — and `l.name` was
    // canonical, so a nicknamed language never matched, the key fell
    // through to the display name string, and colorFor() defaulted to
    // green. Every mixed-language cell on the heatmap looked the same.
    const languages = [
      { id: 'spanish', name: 'Spanish', nickname: 'Español' },
      { id: 'bengali', name: 'Bengali', nickname: 'বাংলা' },
      { id: 'urdu', name: 'Urdu', nickname: 'اردو' },
    ]
    const activities = [
      { language: 'Español', minutes: 25 },     // nicknamed display
      { language: 'বাংলা', minutes: 15 },        // non-Latin nickname
      { language: 'اردو', minutes: 10 },         // non-Latin nickname
    ]
    const groups = groupActivitiesByLanguageId(activities, languages, nameFor)
    expect(groups).toEqual({ spanish: 25, bengali: 15, urdu: 10 })
  })

  it('sums minutes when the same language appears across multiple sessions', () => {
    const languages = [{ id: 'german', name: 'German' }]
    const activities = [
      { language: 'German', minutes: 15 },
      { language: 'German', minutes: 30 },
      { language: 'German', minutes: 5 },
    ]
    expect(groupActivitiesByLanguageId(activities, languages, nameFor)).toEqual({
      german: 50,
    })
  })

  it('falls back to the display name as the key when the language is unknown', () => {
    // Defensive: an activity for a language the user has since removed
    // shouldn't crash, and downstream colour lookups will default to
    // stone grey — that's the right behaviour for a stale reference.
    const languages = [{ id: 'german', name: 'German' }]
    const activities = [{ language: 'Klingon', minutes: 10 }]
    expect(groupActivitiesByLanguageId(activities, languages, nameFor)).toEqual({
      Klingon: 10,
    })
  })

  it('treats a missing minutes field as zero (no NaN propagation)', () => {
    const languages = [{ id: 'german', name: 'German' }]
    const activities = [
      { language: 'German', minutes: 15 },
      { language: 'German' }, // no minutes
    ]
    expect(groupActivitiesByLanguageId(activities, languages, nameFor)).toEqual({
      german: 15,
    })
  })

  it('handles an empty activities array', () => {
    expect(groupActivitiesByLanguageId([], [{ id: 'german', name: 'German' }], nameFor)).toEqual({})
  })
})
