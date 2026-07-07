import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lookupUrl, normalizeDefinitions, firstDefinition, allDefinitions, lookupWord } from './dictLookup.js'

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

describe('lookupWord', () => {
  let originalFetch
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns the definition list on a 200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => SAMPLE_RESPONSE,
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

  it('returns a clean no-entry result on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false, json: async () => ({}) })
    const out = await lookupWord('zzznotaword')
    expect(out.ok).toBe(false)
    expect(out.definitions).toEqual([])
    expect(out.error).toBe('No entry')
  })

  it('returns an HTTP error on a 5xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false, json: async () => ({}) })
    const out = await lookupWord('gehen')
    expect(out.ok).toBe(false)
    expect(out.error).toBe('HTTP 500')
  })

  it('returns a no-definitions result when the JSON is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({}) })
    const out = await lookupWord('gehen')
    expect(out.ok).toBe(false)
    expect(out.error).toBe('No definitions')
  })

  it('times out if the request takes too long', async () => {
    // A fetch that never resolves — the AbortController's setTimeout in
    // lookupWord fires and rejects the underlying request.
    globalThis.fetch = vi.fn().mockImplementation(
      (_, { signal }) => new Promise((_, reject) => {
        if (signal) signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    )
    const out = await lookupWord('gehen', { fetch: globalThis.fetch, timeoutMs: 50 })
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
})