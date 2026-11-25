// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { neutralizeCell, toCsv } from './csv'

describe('neutralizeCell (formula injection, R-012)', () => {
  it.each([
    ['=HYPERLINK("http://evil.example","x")', `'=HYPERLINK("http://evil.example","x")`],
    ['+cmd|" /C calc"!A0', `'+cmd|" /C calc"!A0`],
    ['-2+3', "'-2+3"],
    ['@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ['\t=1', "'\t=1"],
    ['Hamza Kareem', 'Hamza Kareem'],
    ['9:15 AM', '9:15 AM'],
  ])('%j → %j', (input, expected) => {
    expect(neutralizeCell(input)).toBe(expected)
  })

  it('prints empty values as empty cells and stringifies numbers', () => {
    expect(neutralizeCell(null)).toBe('')
    expect(neutralizeCell(undefined)).toBe('')
    expect(neutralizeCell(42)).toBe('42')
  })
})

describe('toCsv', () => {
  it('quotes commas, quotes and newlines, uses CRLF and a BOM', () => {
    const csv = toCsv(['Name', 'Note'], [['Rana, Bilal', 'He said "ok"\nthen left']])
    expect(csv).toBe('\uFEFFName,Note\r\n"Rana, Bilal","He said ""ok""\nthen left"\r\n')
  })

  it('neutralizes before quoting', () => {
    expect(toCsv(['A'], [['=1,2']])).toBe(`\uFEFFA\r\n"'=1,2"\r\n`)
  })
})
