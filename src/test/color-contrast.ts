// Test-only helpers: WCAG 2.x contrast ratios for OKLCH design tokens.
// Conversion: OKLCH -> OKLab -> linear sRGB (Björn Ottosson's matrices), clamped to gamut.

export type Oklch = { l: number; c: number; h: number }

/** Parse `--name: oklch(L C H)` declarations from a CSS block. Alpha forms are ignored. */
export function parseOklchVariables(css: string): Map<string, Oklch> {
  const vars = new Map<string, Oklch>()
  const pattern = /--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g
  for (const match of css.matchAll(pattern)) {
    const [, name, l, c, h] = match
    if (name && l && c && h) vars.set(name, { l: Number(l), c: Number(c), h: Number(h) })
  }
  return vars
}

/** Linear-light sRGB channels in [0, 1]. */
export function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (x: number) => Math.min(1, Math.max(0, x))
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
}

/** WCAG relative luminance (channels are already linear). */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, from 1 to 21. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
