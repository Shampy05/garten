import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  lookupUrl,
  actionApiUrl,
  normalizeDefinitions,
  firstDefinition,
  allDefinitions,
  stripWikiMarkup,
  parseWikitextDefinitions,
  lookupWord,
  clearLookupCache,
} from './dictLookup.js'

const SAMPLE_RESPONSE = {
  German: [
    {
      partOfSpeech: 'intransitive verb',
      language: 'German',
      definitions: [
        { definition: 'to go (to move in a specified direction)' },
        { definition: 'to leave, to depart' },
      ],
    },
  ],
  French: [
    {
      partOfSpeech: 'verb',
      language: 'French',
      definitions: [{ definition: 'to go' }],
    },
  ],
}

describe('lookupUrl', () => {
  it('builds the Wiktionary REST URL with a single word', () => {
    expect(lookupUrl('gehen')).toBe(
      'https://en.wiktionary.org/api/rest_v1/page/definition/gehen'
    )
  })

  it('encodes spaces and special characters', () => {
    expect(lookupUrl('give up')).toBe(
      'https://en.wiktionary.org/api/rest_v1/page/definition/give_up'
    )
    expect(lookupUrl('café')).toBe(
      'https://en.wiktionary.org/api/rest_v1/page/definition/caf%C3%A9'
    )
  })

  it('returns null for empty / whitespace input', () => {
    expect(lookupUrl('')).toBeNull()
    expect(lookupUrl('   ')).toBeNull()
    expect(lookupUrl(null)).toBeNull()
  })
})

describe('actionApiUrl', () => {
  it('builds the action API URL with the term and a JSON wikitext parse', () => {
    const url = actionApiUrl('gehen', 'de')
    expect(url).toContain('https://en.wiktionary.org/w/api.php?')
    expect(url).toContain('action=parse')
    expect(url).toContain('prop=wikitext')
    expect(url).toContain('format=json')
    expect(url).toContain('page=gehen')
  })

  it('includes origin=* so the request is CORS-allowed from a browser', () => {
    // MediaWiki honors this parameter to add Access-Control-Allow-Origin.
    // Without it, the action API can't be called directly from the SPA.
    expect(actionApiUrl('gehen', 'de')).toContain('origin=*')
  })

  it('returns null for empty input', () => {
    expect(actionApiUrl('')).toBeNull()
    expect(actionApiUrl('   ')).toBeNull()
  })
})

describe('normalizeDefinitions', () => {
  it('flattens the Wiktionary shape into a single list of {language, partOfSpeech, definition}', () => {
    const out = normalizeDefinitions(SAMPLE_RESPONSE)
    expect(out).toEqual([
      { language: 'German', partOfSpeech: 'intransitive verb', definition: 'to go (to move in a specified direction)' },
      { language: 'German', partOfSpeech: 'intransitive verb', definition: 'to leave, to depart' },
      { language: 'French', partOfSpeech: 'verb', definition: 'to go' },
    ])
  })

  it('skips entries with empty definition text', () => {
    const json = {
      L: [{ partOfSpeech: 'n', definitions: [{ definition: '' }, { definition: '   ' }, { definition: 'real one' }] }],
    }
    expect(normalizeDefinitions(json)).toEqual([
      { language: 'L', partOfSpeech: 'n', definition: 'real one' },
    ])
  })

  it('handles a missing or invalid payload', () => {
    expect(normalizeDefinitions(null)).toEqual([])
    expect(normalizeDefinitions({})).toEqual([])
    expect(normalizeDefinitions('oops')).toEqual([])
  })

  it('accepts a plain-string definition (Wiktionary sometimes emits a string instead of an object)', () => {
    const out = normalizeDefinitions({ L: [{ definitions: ['just a string'] }] })
    expect(out[0].definition).toBe('just a string')
  })

  it('strips mw:WikiLink HTML that the REST endpoint embeds in JSON definitions', () => {
    // Wiktionary's REST endpoint returns pre-rendered HTML inside the
    // `definition` string for entries like 'Umgang' — that's the parser
    // rendering [[dealings]] as <a> markup. We strip it so the user sees
    // clean prose.
    const json = {
      German: [
        {
          partOfSpeech: 'Noun',
          definitions: [
            { definition: '<a rel="mw:WikiLink" href="/wiki/dealings" title="dealings">dealings</a>, (social) <a rel="mw:WikiLink" href="/wiki/intercourse" title="intercourse">intercourse</a>' },
          ],
        },
      ],
    }
    const out = normalizeDefinitions(json)
    expect(out[0].definition).toBe('dealings , (social) intercourse')
  })

  it('drops stray residue shorter than MIN_DEFINITION_CHARS after markup removal', () => {
    const json = {
      L: [{ partOfSpeech: 'n', definitions: [{ definition: '{{q|informal}} .' }, { definition: 'a real gloss' }] }],
    }
    expect(normalizeDefinitions(json)).toEqual([
      { language: 'L', partOfSpeech: 'n', definition: 'a real gloss' },
    ])
  })

  describe('with a languageCode filter', () => {
    // Regression for the real "die" entry: Wiktionary's REST JSON keys
    // definitions by its own internal bucket ("en", "de", "other", ...),
    // NOT the target language — "die" alone carries 18 unrelated language
    // sections. Without filtering, a German learner's first definition
    // could easily be the English "to stop living" instead of "the".
    const HOMOGRAPH = {
      en: [{ partOfSpeech: 'Verb', language: 'English', definitions: [{ definition: 'to stop living' }] }],
      de: [{ partOfSpeech: 'Article', language: 'German', definitions: [{ definition: 'the (feminine)' }] }],
    }

    it('keeps only the sense matching the target language', () => {
      expect(normalizeDefinitions(HOMOGRAPH, 'de')).toEqual([
        { language: 'German', partOfSpeech: 'Article', definition: 'the (feminine)' },
      ])
      expect(normalizeDefinitions(HOMOGRAPH, 'en')).toEqual([
        { language: 'English', partOfSpeech: 'Verb', definition: 'to stop living' },
      ])
    })

    it('returns [] rather than another language\'s definition when the target has no entry', () => {
      const onlyEnglish = { en: HOMOGRAPH.en }
      expect(normalizeDefinitions(onlyEnglish, 'de')).toEqual([])
    })

    it('matches a language variant via prefix — Norwegian Bokmål/Nynorsk under the "no" code', () => {
      // Wiktionary never emits a bare "Norwegian" section; both real
      // varieties (and their bucket key, often "other") must still match.
      const json = {
        other: [
          { partOfSpeech: 'Noun', language: 'Norwegian Bokmål', definitions: [{ definition: 'house' }] },
          { partOfSpeech: 'Noun', language: 'Norwegian Nynorsk', definitions: [{ definition: 'house (nynorsk)' }] },
          { partOfSpeech: 'Noun', language: 'Middle English', definitions: [{ definition: 'unrelated' }] },
        ],
      }
      expect(normalizeDefinitions(json, 'no')).toEqual([
        { language: 'Norwegian Bokmål', partOfSpeech: 'Noun', definition: 'house' },
        { language: 'Norwegian Nynorsk', partOfSpeech: 'Noun', definition: 'house (nynorsk)' },
      ])
    })

    it('falls back to the outer JSON key when a sense has no explicit language field', () => {
      // Covers callers/tests whose fixtures predate the `sense.language` field.
      const json = { German: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'a walk' }] }] }
      expect(normalizeDefinitions(json, 'de')).toEqual([
        { language: 'German', partOfSpeech: 'Noun', definition: 'a walk' },
      ])
    })
  })
})

describe('firstDefinition / allDefinitions', () => {
  it('firstDefinition returns the first normalized string', () => {
    expect(firstDefinition(SAMPLE_RESPONSE)).toBe('to go (to move in a specified direction)')
  })

  it('allDefinitions returns just the strings', () => {
    expect(allDefinitions(SAMPLE_RESPONSE)).toEqual([
      'to go (to move in a specified direction)',
      'to leave, to depart',
      'to go',
    ])
  })
})

describe('stripWikiMarkup', () => {
  it('removes simple templates', () => {
    expect(stripWikiMarkup('{{inflection of|muskulös|tr=adj}}')).toBe('')
  })

  it('removes HTML tags', () => {
    expect(stripWikiMarkup('<a href="/wiki/x">strong</a> genitive singular')).toBe('strong genitive singular')
  })

  it('expands [[link|display]] to display text', () => {
    expect(stripWikiMarkup('[[Appendix:Glossary#strong|strong]] [[Appendix:Glossary#genitive|genitive]]')).toBe('strong genitive')
  })

  it('expands bare [[link]] to its target', () => {
    expect(stripWikiMarkup('[[strong]]')).toBe('strong')
  })

  it('removes bold/italic markup', () => {
    expect(stripWikiMarkup("'''muscular'''")).toBe('muscular')
  })

  it('collapses whitespace', () => {
    expect(stripWikiMarkup('a   b\n\n  c')).toBe('a b c')
  })

  it('handles empty / non-string', () => {
    expect(stripWikiMarkup('')).toBe('')
    expect(stripWikiMarkup(null)).toBe('')
    expect(stripWikiMarkup(undefined)).toBe('')
  })
})

describe('parseWikitextDefinitions', () => {
  it('parses the German section and returns numbered definitions in order', () => {
    const wt = [
      '==German==',
      '===Verb===',
      '# to go',
      '# to leave',
      '# to die',
      '===Noun===',
      '# a walk',
      '==French==',
      '===Verb===',
      '# to joke',
    ].join('\n')
    const out = parseWikitextDefinitions(wt, 'de')
    expect(out).toEqual([
      { partOfSpeech: 'Verb', definition: 'to go' },
      { partOfSpeech: 'Verb', definition: 'to leave' },
      { partOfSpeech: 'Verb', definition: 'to die' },
      { partOfSpeech: 'Noun', definition: 'a walk' },
    ])
  })

  it('skips glosses whose text collapses to empty after markup removal', () => {
    const wt = [
      '==German==',
      '===Adjective===',
      '# {{inflection of|muskulös|tr=adj}}',
      '# real meaning',
    ].join('\n')
    const out = parseWikitextDefinitions(wt, 'de')
    expect(out).toEqual([{ partOfSpeech: 'Adjective', definition: 'real meaning' }])
  })

  it('returns [] for a different language section that is absent', () => {
    const wt = ['==French==', '===Noun===', '# a thing'].join('\n')
    expect(parseWikitextDefinitions(wt, 'de')).toEqual([])
  })

  it('returns [] for missing language code', () => {
    const wt = '==German==\n===Verb===\n# to go'
    expect(parseWikitextDefinitions(wt, null)).toEqual([])
  })

  it('matches a real Wiktionary language-variant header via prefix (Norwegian Bokmål for code "no")', () => {
    // Wiktionary never emits a bare "==Norwegian==" section — only the
    // variant headers. An exact-match target would silently return []
    // for every Norwegian word; the prefix match fixes that.
    const wt = ['==Norwegian Bokmål==', '===Noun===', '# house', '==Danish==', '===Noun===', '# house (danish)'].join('\n')
    expect(parseWikitextDefinitions(wt, 'no')).toEqual([{ partOfSpeech: 'Noun', definition: 'house' }])
  })

  it('matches the section header case-insensitively', () => {
    const wt = ['==german==', '# to go'].join('\n')
    expect(parseWikitextDefinitions(wt, 'de')).toEqual([
      { partOfSpeech: '', definition: 'to go' },
    ])
  })
})

describe('lookupWord', () => {
  let originalFetch
  beforeEach(() => {
    originalFetch = globalThis.fetch
    clearLookupCache()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearLookupCache()
  })

  it('returns the definition list on a 200 JSON response from REST', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => SAMPLE_RESPONSE,
      text: async () => JSON.stringify(SAMPLE_RESPONSE),
    })
    const out = await lookupWord('gehen', { fetch: globalThis.fetch })
    expect(out.ok).toBe(true)
    expect(out.definitions).toEqual([
      'to go (to move in a specified direction)',
      'to leave, to depart',
      'to go',
    ])
    expect(out.error).toBeNull()
  })

  it('strips embedded mw:WikiLink HTML from REST definitions end-to-end', async () => {
    // Regression for the Umgang bug — the REST JSON's definition field
    // contains rendered HTML anchors; the user must never see those.
    const json = {
      German: [
        {
          partOfSpeech: 'Noun',
          definitions: [
            { definition: '<a rel="mw:WikiLink" href="/wiki/dealings" title="dealings">dealings</a>, (social) <a rel="mw:WikiLink" href="/wiki/intercourse" title="intercourse">intercourse</a>' },
            { definition: '<a rel="mw:WikiLink" href="/wiki/acquaintance" title="acquaintance">acquaintances</a>' },
          ],
        },
      ],
    }
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => json,
      text: async () => JSON.stringify(json),
    })
    const out = await lookupWord('Umgang', { languageCode: 'de', fetch: globalThis.fetch })
    expect(out.ok).toBe(true)
    expect(out.definitions).toEqual([
      'dealings , (social) intercourse',
      'acquaintances',
    ])
  })

  it('filters REST results to the target language, ignoring unrelated homograph sections', async () => {
    // Regression for the real "die" entry, which carries 18 language
    // sections on English Wiktionary. Before the languageCode filter, a
    // German learner's auto-filled meaning could be the English "to stop
    // living" sense just because "en" happened to sort first.
    const json = {
      en: [{ partOfSpeech: 'Verb', language: 'English', definitions: [{ definition: 'to stop living' }] }],
      de: [{ partOfSpeech: 'Article', language: 'German', definitions: [{ definition: 'the (feminine)' }] }],
    }
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => json,
      text: async () => JSON.stringify(json),
    })
    const out = await lookupWord('die', { languageCode: 'de', fetch: globalThis.fetch })
    expect(out.ok).toBe(true)
    expect(out.definitions).toEqual(['the (feminine)'])
  })

  it('falls back to the action API when REST has content but none tagged for the target language', async () => {
    const restJson = { en: [{ partOfSpeech: 'Verb', language: 'English', definitions: [{ definition: 'to stop living' }] }] }
    const wikitext = ['==German==', '===Article===', '# the (feminine)'].join('\n')
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/rest_v1/')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
          json: async () => restJson,
          text: async () => JSON.stringify(restJson),
        })
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => ({ parse: { wikitext: { '*': wikitext } } }),
        text: async () => '',
      })
    })
    const out = await lookupWord('die', { languageCode: 'de', fetch: globalThis.fetch })
    expect(out.ok).toBe(true)
    expect(out.definitions).toEqual(['the (feminine)'])
  })

  it('does NOT fall back to the action API when REST JSON is genuinely empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => ({}),
      text: async () => '{}',
    })
    const out = await lookupWord('gehen', { languageCode: 'de', fetch: globalThis.fetch })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('No definitions')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to the action API when REST returns 404', async () => {
    const wikitext = ['==German==', '===Adjective===', '# muscular'].join('\n')
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/rest_v1/')) {
        return Promise.resolve({ status: 404, ok: false, headers: { get: () => '' }, json: async () => ({}), text: async () => '' })
      }
      // action API
      return Promise.resolve({
        status: 200,
        ok: true,
        headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => ({ parse: { wikitext: { '*': wikitext } } }),
        text: async () => '',
      })
    })
    const out = await lookupWord('muskulösen', { languageCode: 'de', fetch: globalThis.fetch })
    expect(out.ok).toBe(true)
    expect(out.definitions).toEqual(['muscular'])
  })

  it('falls back to the action API when REST returns HTML (Parsoid rendering)', async () => {
    const html = '<span class="form-of-definition">inflection of …</span>'
    const wikitext = ['==German==', '===Adjective===', '# muscular'].join('\n')
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/rest_v1/')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
          json: async () => { throw new Error('not json') },
          text: async () => html,
        })
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => ({ parse: { wikitext: { '*': wikitext } } }),
        text: async () => '',
      })
    })
    const out = await lookupWord('muskulösen', { languageCode: 'de', fetch: globalThis.fetch })
    expect(out.ok).toBe(true)
    expect(out.definitions).toEqual(['muscular'])
  })

  it('returns a clean no-entry result when both endpoints 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false, headers: { get: () => '' }, json: async () => ({}), text: async () => '' })
    const out = await lookupWord('zzznotaword', { languageCode: 'de' })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('No entry')
  })

  it('returns an HTTP error on a 5xx from REST and does NOT fall back', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false, headers: { get: () => '' }, json: async () => ({}), text: async () => '' })
    const out = await lookupWord('gehen', { languageCode: 'de' })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('HTTP 500')
  })

  it('returns a no-definitions result when the REST JSON is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => ({}),
      text: async () => '{}',
    })
    const out = await lookupWord('gehen', { languageCode: 'de' })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('No definitions')
  })

  it('times out if the REST request takes too long', async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_, { signal }) => new Promise((_, reject) => {
        if (signal) signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    )
    const out = await lookupWord('gehen', { languageCode: 'de', fetch: globalThis.fetch, timeoutMs: 50 })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('Timed out')
  })

  it('returns early when the term is empty', async () => {
    const fetchSpy = vi.fn()
    const out = await lookupWord('', { fetch: fetchSpy })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('No term')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns No definitions when the action API wikitext has no matching language section', async () => {
    const wikitext = ['==French==', '===Noun===', '# un truc'].join('\n')
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/rest_v1/')) {
        return Promise.resolve({ status: 404, ok: false, headers: { get: () => '' }, json: async () => ({}), text: async () => '' })
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => ({ parse: { wikitext: { '*': wikitext } } }),
        text: async () => '',
      })
    })
    const out = await lookupWord('something', { languageCode: 'de', fetch: globalThis.fetch })
    expect(out.ok).toBe(false)
    expect(out.error).toBe('No definitions')
  })

  it('memoizes a 404 No entry result and does NOT re-hit Wiktionary on the second click', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 404, ok: false, headers: { get: () => '' }, json: async () => ({}), text: async () => '',
    })
    globalThis.fetch = fetchSpy
    const first = await lookupWord('zzznotaword', { languageCode: 'de' })
    expect(first.ok).toBe(false)
    expect(first.error).toBe('No entry')
    expect(fetchSpy).toHaveBeenCalledTimes(2) // REST 404 → action API 404
    const second = await lookupWord('zzznotaword', { languageCode: 'de' })
    expect(second.ok).toBe(false)
    expect(second.error).toBe('No entry')
    // Cached — no new fetch on the second click.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('keys the negative cache by (term, languageCode) so a German miss and a French miss don\'t collide', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 404, ok: false, headers: { get: () => '' }, json: async () => ({}), text: async () => '',
    })
    globalThis.fetch = fetchSpy
    await lookupWord('foo', { languageCode: 'de' })
    await lookupWord('foo', { languageCode: 'fr' })
    // Two separate misses — each one pays its 2-call price.
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('does NOT memoize a positive result — second click re-fetches so a refined Wiktionary gloss wins', async () => {
    const json = { German: [{ partOfSpeech: 'n', definitions: [{ definition: 'to go' }] }] }
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200, ok: true,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => json, text: async () => JSON.stringify(json),
    })
    globalThis.fetch = fetchSpy
    await lookupWord('gehen', { languageCode: 'de' })
    await lookupWord('gehen', { languageCode: 'de' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('clearLookupCache() forces the next click to re-fetch', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 404, ok: false, headers: { get: () => '' }, json: async () => ({}), text: async () => '',
    })
    globalThis.fetch = fetchSpy
    await lookupWord('foo', { languageCode: 'de' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    clearLookupCache()
    await lookupWord('foo', { languageCode: 'de' })
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })
})