export const languages = [
  'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese',
  'Aymara', 'Azerbaijani', 'Bambara', 'Basque', 'Belarusian', 'Bengali',
  'Bislama', 'Bosnian', 'Breton', 'Bulgarian', 'Burmese',
  'Catalan', 'Cebuano', 'Chinese', 'Corsican', 'Cree', 'Croatian', 'Czech',
  'Danish', 'Dutch', 'Dzongkha',
  'English', 'Esperanto', 'Estonian', 'Ewe',
  'Faroese', 'Fijian', 'Finnish', 'French', 'Frisian', 'Fulah',
  'Galician', 'Georgian', 'German', 'Greek', 'Guarani', 'Gujarati',
  'Haitian Creole', 'Hausa', 'Hawaiian', 'Hebrew', 'Hindi', 'Hungarian',
  'Icelandic', 'Igbo', 'Indonesian', 'Irish', 'Italian',
  'Japanese', 'Javanese',
  'Kannada', 'Kazakh', 'Khmer', 'Kinyarwanda', 'Korean', 'Kurdish', 'Kyrgyz',
  'Lao', 'Latin', 'Latvian', 'Lingala', 'Lithuanian', 'Luxembourgish',
  'Macedonian', 'Malagasy', 'Malay', 'Malayalam', 'Maltese', 'Maori',
  'Marathi', 'Mongolian',
  'Nepali', 'Norwegian',
  'Oriya', 'Oromo', 'Ossetian',
  'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi',
  'Quechua',
  'Romanian', 'Romansh', 'Russian',
  'Samoan', 'Sanskrit', 'Scottish Gaelic', 'Serbian', 'Shona', 'Sindhi',
  'Sinhala', 'Slovak', 'Slovenian', 'Somali', 'Spanish', 'Sundanese',
  'Swahili', 'Swati', 'Swedish',
  'Tagalog', 'Tahitian', 'Tajik', 'Tamil', 'Tatar', 'Telugu', 'Thai',
  'Tibetan', 'Tigrinya', 'Tongan', 'Turkish', 'Turkmen',
  'Ukrainian', 'Urdu', 'Uyghur', 'Uzbek',
  'Vietnamese',
  'Welsh', 'Wolof',
  'Xhosa',
  'Yiddish', 'Yoruba',
  'Zulu'
]

export function matchLanguage(query) {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase()
  return languages.filter(l => l.toLowerCase().includes(q)).slice(0, 8)
}
