// Heatmap cell helpers — pure, testable. Lives outside the component so the
// nickname-aware grouping can be pinned with a unit test (and so the same
// logic can be reused by the InsightCard, the activity breakdown, etc. if
// they ever need to bucket minutes by language).
//
// The grouping key here is the language id, not the display name, because
// downstream `colorFor(id)` looks the colour up by id. The cell-rendering
// helpers then read `groups[id]` and pass the id straight into the colour
// lookup, so the group key must be a real id, not a nickname string.

/**
 * Bucket per-session minutes by language id.
 *
 * @param {Array} activities - each { language, type, minutes } where
 *   `language` is the *display* name (the result of nameFor() — so it
 *   may be a nickname like 'Español' rather than the canonical 'Spanish').
 * @param {Array} languages - the user's tracked languages, each with
 *   { id, name, nickname? }.
 * @param {Function} nameFor - the languageLookup's nameFor(id) helper,
 *   which resolves an id to its display name. Passed in so this helper
 *   stays pure and testable.
 * @returns {Object} a map of language id → minutes.
 */
export function groupActivitiesByLanguageId(activities, languages, nameFor) {
  const groups = {}
  for (const a of activities) {
    // Match the activity's display name against the display name we get
    // back from nameFor(id) for each tracked language. Going through
    // nameFor keeps the lookup consistent with everywhere else in the app
    // — a language with a nickname shows up under its nickname, the
    // canonical name, and any whitespace-only fallbacks.
    const lang = languages.find((l) => nameFor(l.id) === a.language)
    const id = lang ? lang.id : a.language
    groups[id] = (groups[id] || 0) + (a.minutes || 0)
  }
  return groups
}
