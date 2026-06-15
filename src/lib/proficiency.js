// Fluency Horizon — research-based proficiency targets.
//
// Target hours are derived from the US Foreign Service Institute (FSI) language
// difficulty categories: the approximate classroom hours a native English
// speaker needs to reach "Professional Working Proficiency" (roughly CEFR
// B2/C1). These are estimates, not promises — they exist to give logged hours a
// destination, not to be exact.

export const DEFAULT_TARGET_HOURS = 1100 // FSI Category III — the broad middle

// Only languages that differ from the Category III default are listed.
const TARGET_OVERRIDES = {
  // Category I — closely related to English (~750h)
  Afrikaans: 750,
  Danish: 750,
  Dutch: 750,
  French: 750,
  Italian: 750,
  Norwegian: 750,
  Portuguese: 750,
  Romanian: 750,
  Spanish: 750,
  Swedish: 750,
  // Category II (~900h)
  German: 900,
  'Haitian Creole': 900,
  Indonesian: 900,
  Malay: 900,
  Swahili: 900,
  // Category IV — "super-hard" (~2200h)
  Arabic: 2200,
  Chinese: 2200,
  Japanese: 2200,
  Korean: 2200,
}

// --- Native-language-aware adjustment ---------------------------------------
//
// The FSI hours above assume an English L1. A Spanish speaker reaches
// Portuguese far faster than an English speaker does; a Japanese speaker has a
// real head start on Korean. There is no published "hours" dataset for
// arbitrary native→target pairs, so we don't invent one. Instead we model
// *relative* proximity and apply it as a discount on the trusted English
// baseline — and only ever a discount, so a target can never come out harder
// than the FSI figure, and an English L1 is always a no-op (backwards safe).
//
// Each language gets a lineage path (broad → specific). Two languages' relation
// rank is the length of their shared prefix; a longer shared path means closer.
// Ranks: 1 unrelated · 2 same family · 3 same branch · 4 same sub-branch ·
// 5 mutually-intelligible cluster. A few genetically-unrelated but contact/areal
// pairs (Japanese–Korean, Chinese–Japanese) are handled by an override map.
//
// Only families that contain a supported native language are tagged in detail;
// everything else stays rank 1 (no adjustment), which is the honest default.

const LINEAGE = {
  // Germanic
  English: ['IE', 'Germanic', 'AngloFrisian'],
  Frisian: ['IE', 'Germanic', 'AngloFrisian'],
  German: ['IE', 'Germanic', 'ContinentalWG', 'HighGerman'],
  Luxembourgish: ['IE', 'Germanic', 'ContinentalWG', 'HighGerman'],
  Yiddish: ['IE', 'Germanic', 'ContinentalWG', 'HighGerman'],
  Dutch: ['IE', 'Germanic', 'ContinentalWG', 'LowFranconian'],
  Afrikaans: ['IE', 'Germanic', 'ContinentalWG', 'LowFranconian'],
  Swedish: ['IE', 'Germanic', 'NorthGmc', 'Scandinavian'],
  Norwegian: ['IE', 'Germanic', 'NorthGmc', 'Scandinavian'],
  Danish: ['IE', 'Germanic', 'NorthGmc', 'Scandinavian'],
  Icelandic: ['IE', 'Germanic', 'NorthGmc', 'Insular'],
  Faroese: ['IE', 'Germanic', 'NorthGmc', 'Insular'],
  // Romance
  Spanish: ['IE', 'Romance', 'IberoRomance', 'WestIberian'],
  Portuguese: ['IE', 'Romance', 'IberoRomance', 'WestIberian'],
  Galician: ['IE', 'Romance', 'IberoRomance', 'WestIberian'],
  Catalan: ['IE', 'Romance', 'IberoRomance'],
  French: ['IE', 'Romance', 'GalloRomance'],
  Italian: ['IE', 'Romance', 'ItaloDalmatian'],
  Corsican: ['IE', 'Romance', 'ItaloDalmatian'],
  Romanian: ['IE', 'Romance', 'EasternRomance'],
  Romansh: ['IE', 'Romance', 'GalloRomance'],
  Latin: ['IE', 'Romance'],
  // Slavic
  Russian: ['IE', 'Slavic', 'EastSlavic', 'EastTight'],
  Ukrainian: ['IE', 'Slavic', 'EastSlavic', 'EastTight'],
  Belarusian: ['IE', 'Slavic', 'EastSlavic', 'EastTight'],
  Polish: ['IE', 'Slavic', 'WestSlavic', 'Lechitic'],
  Czech: ['IE', 'Slavic', 'WestSlavic', 'CzechSlovak'],
  Slovak: ['IE', 'Slavic', 'WestSlavic', 'CzechSlovak'],
  Bulgarian: ['IE', 'Slavic', 'SouthSlavic', 'EastSouth'],
  Macedonian: ['IE', 'Slavic', 'SouthSlavic', 'EastSouth'],
  Croatian: ['IE', 'Slavic', 'SouthSlavic', 'WestSouth'],
  Serbian: ['IE', 'Slavic', 'SouthSlavic', 'WestSouth'],
  Bosnian: ['IE', 'Slavic', 'SouthSlavic', 'WestSouth'],
  Slovenian: ['IE', 'Slavic', 'SouthSlavic'],
  // Indo-Aryan
  Hindi: ['IE', 'IndoAryan', 'CentralZone', 'Hindustani'],
  Urdu: ['IE', 'IndoAryan', 'CentralZone', 'Hindustani'],
  Punjabi: ['IE', 'IndoAryan', 'NorthwestZone'],
  Sindhi: ['IE', 'IndoAryan', 'NorthwestZone'],
  Gujarati: ['IE', 'IndoAryan', 'WesternZone'],
  Marathi: ['IE', 'IndoAryan', 'SouthernZone'],
  Bengali: ['IE', 'IndoAryan', 'EasternZone', 'Gauda'],
  Assamese: ['IE', 'IndoAryan', 'EasternZone', 'Gauda'],
  Oriya: ['IE', 'IndoAryan', 'EasternZone'],
  Nepali: ['IE', 'IndoAryan', 'NorthernZone'],
  Sinhala: ['IE', 'IndoAryan', 'Insular'],
  Sanskrit: ['IE', 'IndoAryan'],
  // Iranian
  Persian: ['IE', 'Iranian', 'SWIranian', 'Persic'],
  Tajik: ['IE', 'Iranian', 'SWIranian', 'Persic'],
  Kurdish: ['IE', 'Iranian', 'NWIranian'],
  Pashto: ['IE', 'Iranian', 'EastIranian'],
  Ossetian: ['IE', 'Iranian', 'EastIranian'],
  // Other Indo-European branches
  Greek: ['IE', 'Hellenic'],
  Armenian: ['IE', 'ArmenianBr'],
  Albanian: ['IE', 'AlbanianBr'],
  Lithuanian: ['IE', 'Baltic'],
  Latvian: ['IE', 'Baltic'],
  Irish: ['IE', 'Celtic', 'Goidelic'],
  'Scottish Gaelic': ['IE', 'Celtic', 'Goidelic'],
  Welsh: ['IE', 'Celtic', 'Brythonic'],
  Breton: ['IE', 'Celtic', 'Brythonic'],
  // East Asian
  Chinese: ['SinoTibetan', 'Sinitic'],
  Tibetan: ['SinoTibetan', 'TibetoBurman'],
  Burmese: ['SinoTibetan', 'TibetoBurman'],
  Dzongkha: ['SinoTibetan', 'TibetoBurman'],
  Japanese: ['Japonic'],
  Korean: ['Koreanic'],
  Vietnamese: ['AustroAsiatic', 'VietMuong'],
  Khmer: ['AustroAsiatic', 'Khmeric'],
  // Turkic
  Turkish: ['Turkic', 'Oghuz'],
  Azerbaijani: ['Turkic', 'Oghuz'],
  Turkmen: ['Turkic', 'Oghuz'],
  Kazakh: ['Turkic', 'Kipchak'],
  Kyrgyz: ['Turkic', 'Kipchak'],
  Tatar: ['Turkic', 'Kipchak'],
  Uzbek: ['Turkic', 'Karluk'],
  Uyghur: ['Turkic', 'Karluk'],
  // Afro-Asiatic (Semitic + others)
  Arabic: ['AfroAsiatic', 'Semitic', 'ArabicGrp'],
  Maltese: ['AfroAsiatic', 'Semitic', 'ArabicGrp'],
  Hebrew: ['AfroAsiatic', 'Semitic', 'Canaanite'],
  Amharic: ['AfroAsiatic', 'Semitic', 'Ethiopic'],
  Tigrinya: ['AfroAsiatic', 'Semitic', 'Ethiopic'],
  // Austronesian
  Indonesian: ['Austronesian', 'MalayoPolynesian', 'Malayic', 'IndoMalay'],
  Malay: ['Austronesian', 'MalayoPolynesian', 'Malayic', 'IndoMalay'],
  Javanese: ['Austronesian', 'MalayoPolynesian', 'Javanese'],
  Sundanese: ['Austronesian', 'MalayoPolynesian', 'Sundanese'],
  Tagalog: ['Austronesian', 'MalayoPolynesian', 'Philippine'],
  Cebuano: ['Austronesian', 'MalayoPolynesian', 'Philippine'],
  Malagasy: ['Austronesian', 'MalayoPolynesian', 'Barito'],
  Maori: ['Austronesian', 'MalayoPolynesian', 'Polynesian'],
  Hawaiian: ['Austronesian', 'MalayoPolynesian', 'Polynesian'],
  Samoan: ['Austronesian', 'MalayoPolynesian', 'Polynesian'],
  Tongan: ['Austronesian', 'MalayoPolynesian', 'Polynesian'],
  Tahitian: ['Austronesian', 'MalayoPolynesian', 'Polynesian'],
  Fijian: ['Austronesian', 'MalayoPolynesian', 'Oceanic'],
  // Dravidian
  Tamil: ['Dravidian', 'South', 'TamilKannada', 'TamilMalayalam'],
  Malayalam: ['Dravidian', 'South', 'TamilKannada', 'TamilMalayalam'],
  Kannada: ['Dravidian', 'South', 'TamilKannada'],
  Telugu: ['Dravidian', 'SouthCentral'],
}

// Genetically-unrelated pairs with a real learning head start from sustained
// contact or a shared writing system. Keyed by alphabetically-sorted pair.
const AREAL = {
  'Japanese|Korean': 4,
  'Chinese|Japanese': 3,
  'Chinese|Korean': 3,
  'Chinese|Vietnamese': 3,
}

// Gap between how related the learner's L1 is to the target vs how related
// English is. Bigger gap = bigger discount. Gap <= 0 means no edge over an
// English speaker, so no change.
const GAP_MULTIPLIER = { 1: 0.8, 2: 0.6, 3: 0.45 }
const MAX_DISCOUNT = 0.35 // floor, for gap >= 4

function commonPrefixLen(a, b) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function arealKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// Relation rank 1..5 (higher = closer). See LINEAGE comment for the scale.
export function relationRank(a, b) {
  if (a === b) return 6
  let rank = 1
  const la = LINEAGE[a]
  const lb = LINEAGE[b]
  if (la && lb) {
    const shared = commonPrefixLen(la, lb)
    rank = shared === 0 ? 1 : Math.min(shared + 1, 5)
  }
  const areal = AREAL[arealKey(a, b)]
  if (areal && areal > rank) rank = areal
  return rank
}

// Discount factor on the English-baseline target for a given native language.
// Always in (0, 1]; 1 means "no closer than an English speaker".
export function nativeMultiplier(nativeLanguage, targetLanguage) {
  if (!nativeLanguage || nativeLanguage === targetLanguage) return 1
  const gap = relationRank(nativeLanguage, targetLanguage) - relationRank('English', targetLanguage)
  if (gap <= 0) return 1
  return GAP_MULTIPLIER[gap] ?? MAX_DISCOUNT
}

// Native languages we model a meaningful adjustment for. Others fall back to
// the English baseline (no adjustment) — the honest default.
export const NATIVE_LANGUAGES = [
  'Afrikaans', 'Arabic', 'Azerbaijani', 'Bengali', 'Bulgarian', 'Catalan',
  'Chinese', 'Croatian', 'Czech', 'Danish', 'Dutch', 'French', 'German',
  'Greek', 'Gujarati', 'Hebrew', 'Hindi', 'Indonesian', 'Italian', 'Japanese',
  'Korean', 'Malay', 'Marathi', 'Norwegian', 'Persian', 'Polish', 'Portuguese',
  'Punjabi', 'Romanian', 'Russian', 'Serbian', 'Spanish', 'Swedish', 'Tagalog',
  'Tamil', 'Telugu', 'Turkish', 'Ukrainian', 'Urdu', 'Vietnamese',
]

export function targetHours(languageName, nativeLanguage = null) {
  const base = TARGET_OVERRIDES[languageName] ?? DEFAULT_TARGET_HOURS
  const adjusted = base * nativeMultiplier(nativeLanguage, languageName)
  return Math.round(adjusted / 25) * 25 // keep it estimate-shaped
}

// Starting-point levels. The fraction is the share of the proficiency target a
// learner has roughly already covered when entering at that level. This lets a
// user say "I'm about intermediate" instead of counting past hours.
export const LEVELS = [
  { key: 'none', label: 'Just starting', fraction: 0 },
  { key: 'a1', label: 'Beginner (A1)', fraction: 0.1 },
  { key: 'a2', label: 'Elementary (A2)', fraction: 0.22 },
  { key: 'b1', label: 'Intermediate (B1)', fraction: 0.45 },
  { key: 'b2', label: 'Upper-intermediate (B2)', fraction: 0.75 },
  { key: 'c1', label: 'Advanced (C1+)', fraction: 1.0 },
]

export function hoursForLevel(languageName, levelKey, nativeLanguage = null) {
  const level = LEVELS.find((l) => l.key === levelKey)
  if (!level) return 0
  return Math.round(targetHours(languageName, nativeLanguage) * level.fraction)
}

// Given an hour offset, return the closest matching level key — used to
// re-display a stored prior_hours value as a level in the editor.
export function levelForHours(languageName, hours, nativeLanguage = null) {
  const h = Number(hours) || 0
  if (h <= 0) return 'none'
  let best = LEVELS[0]
  let bestDiff = Infinity
  for (const level of LEVELS) {
    const diff = Math.abs(hoursForLevel(languageName, level.key, nativeLanguage) - h)
    if (diff < bestDiff) {
      bestDiff = diff
      best = level
    }
  }
  return best.key
}

// Estimate months remaining at a given weekly pace (hours/week).
// Returns null when there isn't enough signal to forecast.
export function forecastMonths(remainingHours, weeklyPaceHours) {
  if (remainingHours <= 0) return 0
  if (!weeklyPaceHours || weeklyPaceHours <= 0) return null
  const weeks = remainingHours / weeklyPaceHours
  return weeks / 4.345 // avg weeks per month
}

// --- Trend-aware pace -------------------------------------------------------
//
// A flat N-day average has two problems: a single session ageing out of the
// window makes the ETA jump (whipsaw), and it can't tell someone ramping up
// from someone winding down. Instead we look back over a longer window and
// weight recent days more heavily with exponential decay — no hard cliff, and
// the pace tracks current behaviour.

export const PACE_WINDOW_DAYS = 56 // 8 weeks of context
export const PACE_HALF_LIFE_DAYS = 14 // a day's contribution halves every 2 weeks

// minutesByAge: array indexed by days-ago (0 = today) holding minutes logged
// that day. Returns an exponentially-weighted pace in hours per week.
export function weightedWeeklyPace(minutesByAge) {
  const tau = PACE_HALF_LIFE_DAYS / Math.LN2
  let weightSum = 0
  let weightedMinutes = 0
  for (let age = 0; age < PACE_WINDOW_DAYS; age++) {
    const w = Math.exp(-age / tau)
    weightSum += w
    weightedMinutes += w * (minutesByAge[age] || 0)
  }
  if (weightSum === 0) return 0
  const weightedDailyMinutes = weightedMinutes / weightSum
  return (weightedDailyMinutes * 7) / 60
}

// Momentum: total minutes in the most recent 4 weeks vs the 4 weeks before,
// as a signed ratio (e.g. 0.2 = pace up 20%). Returns null when there isn't a
// prior-period baseline to compare against (a fresh ramp-up has no "before").
export function paceMomentum(minutesByAge) {
  const half = PACE_WINDOW_DAYS / 2
  let recent = 0
  let prior = 0
  for (let age = 0; age < PACE_WINDOW_DAYS; age++) {
    const m = minutesByAge[age] || 0
    if (age < half) recent += m
    else prior += m
  }
  if (prior <= 0) return null
  return (recent - prior) / prior
}
