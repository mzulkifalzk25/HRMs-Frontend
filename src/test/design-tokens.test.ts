// @vitest-environment node
// Guards the P1-T03 design tokens in src/index.css against WCAG AA regressions.
// Runs in the Node environment: no DOM needed, and `import.meta.url` is a file: URL.
// Read from disk: Vitest skips CSS processing, so `import css from '../index.css?raw'`
// resolves to an empty string in tests.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio, parseOklchVariables } from './color-contrast'

const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const rootStart = indexCss.indexOf(':root {')
const rootBlock = indexCss.slice(rootStart, indexCss.indexOf('}', rootStart))
const tokens = parseOklchVariables(rootBlock)

function token(name: string) {
  const value = tokens.get(name)
  if (!value) throw new Error(`Token --${name} not found in :root of src/index.css`)
  return value
}

// [foreground, background] pairs used for text. WCAG AA normal text: 4.5:1.
const textPairs: Array<[string, string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['primary', 'card'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive-subtle-foreground', 'destructive-subtle'],
  ['destructive', 'card'],
  ['success-foreground', 'success'],
  ['success-subtle-foreground', 'success-subtle'],
  ['warning-foreground', 'warning'],
  ['warning-subtle-foreground', 'warning-subtle'],
  ['info-foreground', 'info'],
  ['info-subtle-foreground', 'info-subtle'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
  ['sidebar-primary-foreground', 'sidebar-primary'],
]

// Non-text UI boundaries (WCAG 1.4.11): 3:1 against the surface they sit on.
const uiPairs: Array<[string, string]> = [
  ['input', 'card'],
  ['ring', 'card'],
  ['ring', 'background'],
]

describe('design tokens (src/index.css)', () => {
  it('defines the tokens under test', () => {
    expect(tokens.size).toBeGreaterThan(30)
  })

  it.each(textPairs)('--%s on --%s meets 4.5:1 (WCAG AA text)', (fg, bg) => {
    expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(uiPairs)('--%s on --%s meets 3:1 (WCAG 1.4.11 UI component)', (fg, bg) => {
    expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(3)
  })
})
