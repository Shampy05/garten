import { describe, it, expect } from 'vitest'
import { bloomFaviconDataUri } from './favicon.js'

describe('bloomFaviconDataUri', () => {
  it('returns a data URI containing both colours', () => {
    const uri = bloomFaviconDataUri('#e2a0ad', '#b95c72')
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
    const decoded = decodeURIComponent(uri)
    expect(decoded).toContain('#e2a0ad')
    expect(decoded).toContain('#b95c72')
  })

  it('produces valid-looking SVG markup', () => {
    const uri = bloomFaviconDataUri('#111111', '#222222')
    const svg = decodeURIComponent(uri.slice('data:image/svg+xml,'.length))
    expect(svg).toMatch(/^<svg/)
    expect(svg).toContain('</svg>')
  })
})
