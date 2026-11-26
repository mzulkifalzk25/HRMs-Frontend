// Small building blocks shared by the report sections: a bar chart with an accessible data table,
// a simple sortable/paginated table, and CSV export (D-087 rules).
import { Download } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PaginationBar } from '@/components/tables/pagination-bar'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { downloadTextFile, toCsv } from '@/lib/csv'
import { userMessage } from '@/services/api'

export function ReportState<T>({
  query,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data?: T; refetch: () => unknown }
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <CardSkeleton lines={4} />
  if (query.isError || query.data === undefined)
    return (
      <ErrorState
        title="Could not load this report"
        message={userMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    )
  return <>{children(query.data)}</>
}

export function BarReportChart({
  title,
  data,
  bars,
}: {
  title: string
  data: Array<Record<string, string | number>>
  bars: Array<{ key: string; label: string; color: string }>
}) {
  if (data.length === 0) return null
  const labelKey = Object.keys(data[0] ?? {})[0] ?? 'label'
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div aria-hidden="true" className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey={labelKey}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
            />
            {bars.map((b) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                name={b.label}
                fill={b.color}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export type Column<T> = {
  label: string
  value: (row: T) => string | number
  /** Display override; CSV and sorting use `value`. */
  render?: (row: T) => ReactNode
  numeric?: boolean
}

const PAGE_SIZES = [25, 50, 100] as const

export function ReportTable<T>({
  caption,
  rows,
  columns,
  fileName,
  empty,
}: {
  caption: string
  rows: T[]
  columns: Column<T>[]
  fileName: string
  empty: string
}) {
  const [sort, setSort] = useState<{ index: number; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  if (rows.length === 0) return <EmptyState title="No data" description={empty} />
  const col = sort ? columns[sort.index] : undefined
  const sorted =
    col && sort
      ? [...rows].sort((a, b) => {
          const x = col.value(a)
          const y = col.value(b)
          return (
            (typeof x === 'number' && typeof y === 'number'
              ? x - y
              : String(x).localeCompare(String(y))) * sort.dir
          )
        })
      : rows
  const shown = sorted.slice((page - 1) * pageSize, page * pageSize)
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadTextFile(
              fileName,
              toCsv(
                columns.map((c) => c.label),
                sorted.map((r) => columns.map((c) => String(c.value(r)))),
              ),
            )
          }
        >
          <Download aria-hidden="true" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead
                  key={c.label}
                  className={c.numeric ? 'text-right' : undefined}
                  aria-sort={
                    sort?.index === i ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() =>
                      setSort({ index: i, dir: sort?.index === i && sort.dir === -1 ? 1 : -1 })
                    }
                  >
                    {c.label}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell
                    key={c.label}
                    className={c.numeric ? 'text-right tabular-nums' : undefined}
                  >
                    {c.render ? c.render(r) : c.value(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > PAGE_SIZES[0] ? (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={rows.length}
          pageSizes={PAGE_SIZES}
          itemLabel="rows"
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
        />
      ) : null}
    </div>
  )
}
