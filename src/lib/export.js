// Data export — turns the user's logged sessions into portable CSV / JSON.
//
// Everything here is pure and client-side: no backend, no network. The data is
// already loaded in memory, so export is just reshaping + a Blob download. CSV
// is a flat, spreadsheet-friendly table of sessions; JSON is a denormalized
// snapshot (entries carry language names) plus a full backup of languages and
// settings, suitable for feeding to an LLM or re-importing later.

import { localDateStr } from './date.js'

// RFC-4180-ish CSV: quote any field with a comma, quote, or newline, and
// double up internal quotes.
function csvField(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function langNameMap(languages) {
  const map = {}
  for (const l of languages) map[l.id] = l.name
  return map
}

// Flat, one-row-per-session CSV with language names resolved.
export function entriesToCSV(entries, languages) {
  const names = langNameMap(languages)
  const header = ['date', 'language', 'type', 'hours', 'minutes', 'total_minutes', 'notes']
  const rows = [...entries]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((e) => [
      e.date,
      names[e.languageId] || e.languageId,
      e.type,
      e.hours,
      e.minutes,
      e.hours * 60 + e.minutes,
      e.notes || '',
    ])
  return [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n')
}

// Denormalized JSON snapshot: a summary header for quick reasoning, the full
// session list with language names inlined, and a backup of languages and the
// weekly goal so the file can stand alone.
export function buildExportObject(entries, languages, weeklyGoalHours) {
  const names = langNameMap(languages)
  const totalMinutes = entries.reduce((sum, e) => sum + e.hours * 60 + e.minutes, 0)
  const dates = entries.map((e) => e.date).sort()

  return {
    exported_at: new Date().toISOString(),
    source: 'Garten',
    summary: {
      languages: languages.length,
      sessions: entries.length,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      first_session: dates[0] || null,
      last_session: dates[dates.length - 1] || null,
      weekly_goal_hours: weeklyGoalHours ?? null,
    },
    languages: languages.map((l) => ({
      name: l.name,
      color: l.color,
      types: l.types,
      prior_hours: Number(l.prior_hours) || 0,
    })),
    sessions: [...entries]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((e) => ({
        date: e.date,
        language: names[e.languageId] || e.languageId,
        type: e.type,
        hours: e.hours,
        minutes: e.minutes,
        total_minutes: e.hours * 60 + e.minutes,
        notes: e.notes || null,
      })),
  }
}

// Trigger a browser download for a generated file.
export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function stamp() {
  return localDateStr(new Date())
}

export function exportCSV(entries, languages) {
  downloadFile(`garten-sessions-${stamp()}.csv`, entriesToCSV(entries, languages), 'text/csv;charset=utf-8')
}

export function exportJSON(entries, languages, weeklyGoalHours) {
  const obj = buildExportObject(entries, languages, weeklyGoalHours)
  downloadFile(`garten-export-${stamp()}.json`, JSON.stringify(obj, null, 2), 'application/json')
}
