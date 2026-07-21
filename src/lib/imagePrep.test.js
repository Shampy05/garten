import { describe, it, expect } from 'vitest'
import { fitWithin } from './imagePrep.js'

describe('fitWithin', () => {
  it('never upscales an image already smaller than maxEdge', () => {
    expect(fitWithin(400, 300, 1600)).toEqual({ width: 400, height: 300, scale: 1 })
  })

  it('downscales a landscape photo to the target long edge', () => {
    const out = fitWithin(3200, 2400, 1600)
    expect(out.width).toBe(1600)
    expect(out.height).toBe(1200)
    expect(out.scale).toBeCloseTo(0.5)
  })

  it('downscales a portrait photo to the target long edge', () => {
    const out = fitWithin(2400, 3200, 1600)
    expect(out.height).toBe(1600)
    expect(out.width).toBe(1200)
  })

  it('treats a square image the same on both axes', () => {
    const out = fitWithin(3000, 3000, 1600)
    expect(out.width).toBe(1600)
    expect(out.height).toBe(1600)
  })

  it('handles a zero/missing dimension without dividing by zero', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0, scale: 1 })
  })
})
