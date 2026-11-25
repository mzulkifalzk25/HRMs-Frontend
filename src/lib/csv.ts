// CSV export (P4-T12, Q-TECH-03: CSV at minimum). Neutralizes spreadsheet formula injection
// (R-012, D6): a cell starting with = + - @ (or tab / carriage return) is prefixed with an
// apostrophe so Excel/LibreOffice/Sheets show it as text instead of executing it.

const DANGEROUS_START = /^[=+\-@\t\r]/

/** Byte-order mark so Excel detects UTF-8 (kept as a code point, not an invisible literal). */
const UTF8_BOM = String.fromCharCode(0xfeff)

export function neutralizeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return DANGEROUS_START.test(text) ? `'${text}` : text
}

function quote(cell: string): string {
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

/** RFC 4180 CSV with CRLF line endings and a BOM so Excel opens UTF-8 correctly. */
export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const lines = [header, ...rows].map((row) =>
    row.map((cell) => quote(neutralizeCell(cell))).join(','),
  )
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`
}

/** Trigger a browser download of `content` as a file. */
export function downloadTextFile(
  filename: string,
  content: string,
  type = 'text/csv;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
