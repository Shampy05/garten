// Small curated stopword sets per language — used by discover.js to drop the
// most frequent function words when picking theme words from a passage.
// Coverage today: English, Spanish, French, German, Italian (ISO 639-1
// 'en', 'es', 'fr', 'de', 'it').
//
// For any language not listed here, callers fall back to *no* stopword
// filtering (length/dedupe only). That is a deliberate, documented trade-off
// rather than silently mis-filtering: keep coverage honest as more languages
// are added by extending STOPWORDS below — keyed by ISO 639-1 code.

export const STOPWORDS = {
  en: new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by',
    'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'once', 'here', 'there',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'can', 'will', 'just', 'don', "don't", 'should', 'now', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'would', 'could', 'ought', "i'm", "you're", "he's", "she's",
    "it's", "we're", "they're", "i've", "you've", "we've", "they've", "i'll",
    "you'll", "he'll", "she'll", "we'll", "they'll", "i'd", "you'd", "he'd",
    "she'd", "we'd", "they'd", 'i', 'me', 'my', 'myself', 'we', 'our', 'ours',
    'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him',
    'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
    'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who',
    'whom', 'this', 'that', 'these', 'those', 'as', 'of', 'also', 'because',
  ]),
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'si',
    'no', 'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'de', 'desde', 'durante',
    'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin',
    'so', 'sobre', 'tras', 'que', 'como', 'cuando', 'donde', 'quien', 'cuyo',
    'es', 'son', 'fue', 'fueron', 'era', 'ser', 'estar', 'está', 'están',
    'estaba', 'estaban', 'ha', 'han', 'había', 'han', 'tener', 'tiene', 'tenía',
    'hacer', 'hace', 'hizo', 'este', 'esta', 'estos', 'estas', 'ese', 'esa',
    'esos', 'esas', 'mio', 'mía', 'tuyo', 'tuya', 'suyo', 'suya', 'nuestro',
    'nuestra', 'vuestro', 'vuestra', 'me', 'te', 'se', 'nos', 'os', 'le', 'les',
    'lo', 'le', 'al', 'del', 'su', 'sus', 'él', 'ella', 'ellos', 'ellas',
    'nosotros', 'nosotras', 'vosotros', 'vosotras', 'usted', 'ustedes', 'yo',
    'tú', 'él', 'más', 'menos', 'muy', 'también', 'todo', 'toda', 'todos',
    'todas', 'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'ya',
  ]),
  fr: new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais', 'si',
    'ne', 'pas', 'à', 'au', 'aux', 'dans', 'en', 'sur', 'sous', 'avec', 'sans',
    'pour', 'par', 'chez', 'entre', 'vers', 'pendant', 'depuis', 'comme',
    'que', 'qui', 'quoi', 'où', 'quand', 'est', 'sont', 'était', 'étaient',
    'être', 'avoir', 'a', 'ont', 'avait', 'faire', 'fait', 'ce', 'cette', 'ces',
    'cet', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'leur',
    'leurs', 'notre', 'votre', 'nos', 'vos', 'je', 'tu', 'il', 'elle', 'nous',
    'vous', 'ils', 'elles', 'on', 'me', 'te', 'se', 'lui', 'leur', 'y', 'en',
    'plus', 'moins', 'très', 'aussi', 'tout', 'toute', 'tous', 'toutes',
    'autre', 'autres', 'même', 'déjà', 'encore',
  ]),
  de: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'einer', 'eines', 'und', 'oder', 'aber', 'wenn', 'dann', 'nicht', 'in', 'im',
    'an', 'am', 'auf', 'unter', 'über', 'mit', 'ohne', 'für', 'von', 'zu', 'zur',
    'zum', 'bei', 'nach', 'vor', 'seit', 'während', 'durch', 'gegen', 'um',
    'ist', 'sind', 'war', 'waren', 'sein', 'haben', 'hat', 'hatte', 'wird',
    'werden', 'wurde', 'wurden', 'machen', 'macht', 'machte', 'dieser', 'diese',
    'dieses', 'dies', 'jener', 'jene', 'jenes', 'mein', 'meine', 'dein', 'deine',
    'sein', 'seine', 'ihr', 'ihre', 'unser', 'unsere', 'euer', 'eure', 'ich',
    'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'mich', 'dich', 'sich', 'uns',
    'euch', 'mir', 'dir', 'ihm', 'ihr', 'ihnen', 'auch', 'noch', 'schon', 'so',
    'als', 'wie', 'was', 'wer', 'wo', 'wann', 'warum', 'weil', 'dass', 'damit',
  ]),
  it: new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'e', 'o', 'ma',
    'se', 'non', 'a', 'in', 'da', 'di', 'del', 'della', 'dei', 'delle', 'con',
    'su', 'per', 'tra', 'fra', 'verso', 'durante', 'fino', 'presso', 'contro',
    'senza', 'come', 'che', 'chi', 'cui', 'il', 'quando', 'dove', 'perché',
    'è', 'sono', 'era', 'erano', 'essere', 'avere', 'ha', 'hanno', 'aveva',
    'fare', 'fa', 'fece', 'questo', 'questa', 'questi', 'queste', 'quello',
    'quella', 'quelli', 'quelle', 'mio', 'mia', 'tuo', 'tua', 'suo', 'sua',
    'loro', 'nostro', 'nostra', 'vostro', 'vostra', 'io', 'tu', 'lui', 'lei',
    'noi', 'voi', 'loro', 'mi', 'ti', 'si', 'ci', 'vi', 'me', 'te', 'sé',
    'anche', 'ancora', 'già', 'più', 'meno', 'molto', 'poco', 'tutto', 'tutta',
    'tutti', 'tutte', 'altro', 'altra', 'altri', 'altre',
  ]),
}

// Has a stopword list for the given ISO 639-1 code? Callers use this to
// decide whether to apply stopword filtering or fall back to length-only.
export function hasStopwords(code) {
  return Boolean(code && STOPWORDS[code.toLowerCase()])
}

export function stopwordsFor(code) {
  return STOPWORDS[code?.toLowerCase()] || null
}