// Per-language grammatical gender for the Word Garden's meaning entry. Many
// languages mark nouns for gender (der/die/das, le/la, etc.) and remembering
// it is half the battle of learning the noun — so the capture/edit forms
// show a one-tap gender toggle, but ONLY for languages that actually have
// one, and only with the genders that language actually has.
//
// This is a best-effort linguistic mapping, same spirit as the FSI
// categories in proficiency.js — sourced from standard descriptive grammars,
// erring toward the mainstream pedagogical treatment where a language's
// system is genuinely disputed or dialect-dependent (e.g. Norwegian Bokmål's
// optional feminine, Albanian's vestigial neuter, Kurmanji vs. Sorani).
// Corrections welcome; any language not listed here defaults to no gender —
// hiding the toggle is always the safe failure mode, never a wrong guess.
//
// Four shapes cover every language in src/lib/languages.js:
//   NONE            - no grammatical gender (English, Chinese, Turkish...)
//   MASC_FEM        - two genders (French, Spanish, Arabic, Hindi, Urdu...)
//   MASC_FEM_NEUTER - three genders (German, Russian, Greek, Gujarati...)
//   COMMON_NEUTER   - Scandinavian/Frisian/Dutch-style: the old masculine/
//                     feminine distinction merged into one "common" gender
//                     opposite neuter, so there is no masculine or feminine
//                     as such (Danish, Dutch, Frisian, Norwegian, Swedish)
export const GENDER_LABELS = {
  masculine: 'Masculine',
  feminine: 'Feminine',
  neuter: 'Neuter',
  common: 'Common',
}

export const GENDERS = Object.keys(GENDER_LABELS)

const NONE = []
const MASC_FEM = ['masculine', 'feminine']
const MASC_FEM_NEUTER = ['masculine', 'feminine', 'neuter']
const COMMON_NEUTER = ['common', 'neuter']

// Keyed by lowercased language name (matches how bookLanguages.js's
// codeForName does its lookup) — callers always have the display name in
// hand from the languages/entries the user already tracks.
const LANGUAGE_GENDERS = {
  afrikaans: NONE,
  albanian: MASC_FEM, // neuter survives for only a handful of nouns; not taught as a productive 3rd gender
  amharic: MASC_FEM,
  arabic: MASC_FEM,
  armenian: NONE,
  assamese: NONE,
  aymara: NONE,
  azerbaijani: NONE,
  bambara: NONE,
  basque: NONE,
  belarusian: MASC_FEM_NEUTER,
  bengali: NONE,
  bislama: NONE,
  bosnian: MASC_FEM_NEUTER,
  breton: MASC_FEM,
  bulgarian: MASC_FEM_NEUTER,
  burmese: NONE,
  catalan: MASC_FEM,
  cebuano: NONE,
  chinese: NONE,
  corsican: MASC_FEM,
  cree: NONE, // animate/inanimate, not masculine/feminine/neuter
  croatian: MASC_FEM_NEUTER,
  czech: MASC_FEM_NEUTER,
  danish: COMMON_NEUTER,
  dutch: COMMON_NEUTER,
  dzongkha: NONE,
  english: NONE,
  esperanto: NONE,
  estonian: NONE,
  ewe: NONE,
  faroese: MASC_FEM_NEUTER,
  fijian: NONE,
  finnish: NONE,
  french: MASC_FEM,
  frisian: COMMON_NEUTER,
  fulah: NONE, // extensive noun-class system, not masc/fem/neuter
  galician: MASC_FEM,
  georgian: NONE,
  german: MASC_FEM_NEUTER,
  greek: MASC_FEM_NEUTER,
  guarani: NONE,
  gujarati: MASC_FEM_NEUTER,
  'haitian creole': NONE,
  hausa: MASC_FEM,
  hawaiian: NONE,
  hebrew: MASC_FEM,
  hindi: MASC_FEM,
  hungarian: NONE,
  icelandic: MASC_FEM_NEUTER,
  igbo: NONE,
  indonesian: NONE,
  irish: MASC_FEM,
  italian: MASC_FEM,
  japanese: NONE,
  javanese: NONE,
  kannada: MASC_FEM_NEUTER,
  kazakh: NONE,
  khmer: NONE,
  kinyarwanda: NONE, // Bantu noun classes, not masc/fem/neuter
  korean: NONE,
  kurdish: MASC_FEM, // Kurmanji; Sorani has none, but Kurmanji is the more commonly taught variety
  kyrgyz: NONE,
  lao: NONE,
  latin: MASC_FEM_NEUTER,
  latvian: MASC_FEM,
  lingala: NONE,
  lithuanian: MASC_FEM,
  luxembourgish: MASC_FEM_NEUTER,
  macedonian: MASC_FEM_NEUTER,
  malagasy: NONE,
  malay: NONE,
  malayalam: NONE, // unlike its Dravidian relatives, doesn't mark gender on inanimate nouns
  maltese: MASC_FEM,
  maori: NONE,
  marathi: MASC_FEM_NEUTER,
  mongolian: NONE,
  nepali: MASC_FEM_NEUTER,
  norwegian: COMMON_NEUTER, // Bokmål's feminine is optional in practice; most learners use common/neuter
  oriya: NONE,
  oromo: MASC_FEM,
  ossetian: NONE, // lost gender, like Persian
  pashto: MASC_FEM,
  persian: NONE,
  polish: MASC_FEM_NEUTER,
  portuguese: MASC_FEM,
  punjabi: MASC_FEM,
  quechua: NONE,
  romanian: MASC_FEM_NEUTER, // its "neuter" is ambigeneric (masc singular / fem plural) but taught as a 3rd gender
  romansh: MASC_FEM,
  russian: MASC_FEM_NEUTER,
  samoan: NONE,
  sanskrit: MASC_FEM_NEUTER,
  'scottish gaelic': MASC_FEM,
  serbian: MASC_FEM_NEUTER,
  shona: NONE, // Bantu noun classes
  sindhi: MASC_FEM,
  sinhala: MASC_FEM_NEUTER, // animate masc/fem, inanimate default neuter
  slovak: MASC_FEM_NEUTER,
  slovenian: MASC_FEM_NEUTER,
  somali: MASC_FEM,
  spanish: MASC_FEM,
  sundanese: NONE,
  swahili: NONE, // Bantu noun classes
  swati: NONE, // Bantu noun classes
  swedish: COMMON_NEUTER,
  tagalog: NONE,
  tahitian: NONE,
  tajik: NONE,
  tamil: MASC_FEM_NEUTER, // animate masc/fem, inanimate default neuter
  tatar: NONE,
  telugu: MASC_FEM_NEUTER, // animate masc/fem, inanimate default neuter
  thai: NONE,
  tibetan: NONE,
  tigrinya: MASC_FEM,
  tongan: NONE,
  turkish: NONE,
  turkmen: NONE,
  ukrainian: MASC_FEM_NEUTER,
  urdu: MASC_FEM,
  uyghur: NONE,
  uzbek: NONE,
  vietnamese: NONE,
  welsh: MASC_FEM,
  wolof: NONE,
  xhosa: NONE, // Bantu noun classes
  yiddish: MASC_FEM_NEUTER,
  yoruba: NONE,
  zulu: NONE, // Bantu noun classes
}

// The genders available for a language name, or [] if it has none (or isn't
// in the table — an unmapped language silently hides the toggle rather than
// guessing). Case-insensitive: callers pass whatever casing the user's
// tracked-language name happens to have.
export function gendersForLanguage(name) {
  if (!name) return NONE
  return LANGUAGE_GENDERS[name.toLowerCase()] || NONE
}

export function hasGrammaticalGender(name) {
  return gendersForLanguage(name).length > 0
}
