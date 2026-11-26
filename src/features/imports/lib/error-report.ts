// Error report (P7-T11): CSV with D-087 rules (formula injection neutralized by `toCsv`).
import { toCsv } from '@/lib/csv'
import { ROW_ACTION_LABELS, type RowResult } from '../schemas/import.schema'

export function errorReportCsv(rows: readonly RowResult[], includeAll = false): string {
  return toCsv(
    ['Row', 'Result', 'Record', 'Messages'],
    rows
      .filter((r) => includeAll || r.action === 'error' || r.action === 'skip')
      .map((r) => [String(r.row), ROW_ACTION_LABELS[r.action], r.key, r.messages.join(' ')]),
  )
}
