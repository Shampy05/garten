// Part-of-speech tag for a planted word. Unlike grammatical gender, this is
// universal — every language has nouns/verbs/adjectives — so there's no
// per-language mapping here, just a fixed vocabulary shown as pills
// (WordCaptureForm, WordCard's edit mode) in the same register as the
// gender toggle.
//
// The main payoff beyond labeling: it gates which *other* fields make sense
// for a word. Gender only means something for a noun (or an unset type, so
// the useful pill doesn't disappear before the gardener has bothered to tag
// anything) — see `isNounlike` below.
export const WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other']

export const WORD_TYPE_LABELS = {
  noun: 'Noun',
  verb: 'Verb',
  adjective: 'Adjective',
  adverb: 'Adverb',
  phrase: 'Phrase',
  other: 'Other',
}

// Whether a gender pill makes sense for this word type. Unset (null/'') and
// 'noun' both qualify — everything else (verb, adjective, adverb, phrase,
// other) hides the gender toggle, since "gender" here means the noun's own
// article/class, not a form an adjective happens to inflect for.
export function isNounlike(wordType) {
  return !wordType || wordType === 'noun'
}
