import { describe, it, expect } from 'vitest'
import { portraitFilename } from './portrait.js'

describe('portraitFilename', () => {
  it('formats the date as garten-garden-YYYY-MM-DD.png', () => {
    expect(portraitFilename(new Date('2026-07-04T15:00:00'))).toBe('garten-garden-2026-07-04.png')
  })
  it('pads single-digit months and days', () => {
    expect(portraitFilename(new Date('2026-01-05T09:00:00'))).toBe('garten-garden-2026-01-05.png')
  })
})
