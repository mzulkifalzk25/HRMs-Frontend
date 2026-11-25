import { describe, expect, it } from 'vitest'
import { contrastRatio, parseOklchVariables, relativeLuminance } from './color-contrast'

const white = { l: 1, c: 0, h: 0 }
const black = { l: 0, c: 0, h: 0 }

describe('color-contrast helpers', () => {
  it('gives luminance 1 for white and 0 for black', () => {
    expect(relativeLuminance(white)).toBeCloseTo(1, 4)
    expect(relativeLuminance(black)).toBeCloseTo(0, 6)
  })

  it('gives 21:1 for black on white and 1:1 for identical colours', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 2)
    expect(contrastRatio(white, white)).toBeCloseTo(1, 6)
  })

  it('matches a known sRGB reference: mid gray #777777 on white is about 4.48:1', () => {
    // #777777 ≈ oklch(0.5693 0 0)
    expect(contrastRatio({ l: 0.5693, c: 0, h: 0 }, white)).toBeCloseTo(4.48, 1)
  })

  it('parses oklch custom properties and ignores other values', () => {
    const vars = parseOklchVariables(`
      --a: oklch(0.5 0.19 268);
      --b: oklch(1 0 0); /* comment */
      --radius: 0.5rem;
      --shadow: 0 1px 2px oklch(0.2 0.02 265 / 0.05);
    `)
    expect(vars.get('a')).toEqual({ l: 0.5, c: 0.19, h: 268 })
    expect(vars.get('b')).toEqual({ l: 1, c: 0, h: 0 })
    expect(vars.has('radius')).toBe(false)
    expect(vars.has('shadow')).toBe(false)
  })
})
