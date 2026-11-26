// Dry-run / execution results (P7-T06…T09): counts and row-by-row outcomes with messages and,
// for updates, before → after. Filter to errors; download the report as CSV.
import { Download } from 'lucide-react'
import { useId, useState } from 'react'
import { EmptyState } from '@/components/feedback/empty-state'
import { NativeSelect } from '@/components/forms/native-select'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { downloadTextFile } from '@/lib/csv'
import { errorReportCsv } from '../lib/error-report'
import { ROW_ACTION_LABELS, type ImportSummary, type RowResult } from '../schemas/import.schema'

const TONE: Record<RowResult['action'], StatusTone> = {
  create: 'success',
  update: 'info',
  skip: 'neutral',
  error: 'danger',
}

export function ImportCounts({ summary, done }: { summary: ImportSummary; done: boolean }) {
  const items: Array<[string, number, StatusTone]> = [
    [done ? 'Created' : 'Will be created', summary.create, 'success'],
    [done ? 'Updated' : 'Will be updated', summary.update, 'info'],
    [done ? 'Skipped' : 'Will be skipped', summary.skip, 'neutral'],
    ['Errors', summary.error, 'danger'],
  ]
  return (
    <dl className="grid gap-3 sm:grid-cols-4">
      {items.map(([label, value, tone]) => (
        <div key={label} className="rounded-md border p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            {value}
            {value > 0 && tone === 'danger' ? (
              <StatusBadge tone="danger">Fix in file</StatusBadge>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

type Filter = '' | RowResult['action']

export function ImportResults({ rows, fileName }: { rows: RowResult[]; fileName: string }) {
  const [filter, setFilter] = useState<Filter>('')
  const filterId = useId()
  const shown = rows.filter((r) => !filter || r.action === filter)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={filterId}>Show</Label>
          <NativeSelect
            id={filterId}
            placeholder="All rows"
            value={filter}
            options={(['error', 'skip', 'update', 'create'] as const).map((a) => ({
              value: a,
              label: `${ROW_ACTION_LABELS[a]} only`,
            }))}
            onChange={(e) => setFilter(e.target.value as Filter)}
          />
        </div>
        <Button
          variant="outline"
          disabled={!rows.some((r) => r.action === 'error' || r.action === 'skip')}
          onClick={() =>
            downloadTextFile(`${fileName.replace(/\.[^.]+$/, '')}-report.csv`, errorReportCsv(rows))
          }
        >
          <Download aria-hidden="true" />
          Download error report
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No rows" description="Nothing matches this filter." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <caption className="sr-only">Import results by row</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.row}>
                  <TableCell className="tabular-nums">{r.row}</TableCell>
                  <TableCell>
                    <StatusBadge tone={TONE[r.action]}>{ROW_ACTION_LABELS[r.action]}</StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-56 truncate">{r.key}</TableCell>
                  <TableCell>
                    <ul className="space-y-0.5 text-sm">
                      {r.messages.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                      {r.changes
                        ? Object.entries(r.changes).map(([field, [before, after]]) => (
                            <li key={field} className="text-muted-foreground">
                              {field}: {before} → {after}
                            </li>
                          ))
                        : null}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
