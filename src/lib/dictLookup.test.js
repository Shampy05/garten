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
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
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
})