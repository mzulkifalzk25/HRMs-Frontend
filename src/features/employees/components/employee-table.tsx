// Directory table (P3-T03) built with TanStack Table v9: the table supplies column/row models,
// we own the markup. Sorting and pagination are server-side (state in the URL), so the table runs
// without client processing features. Below the md breakpoint the same rows render as cards.
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Link } from 'react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROLE_LABELS } from '@/features/authentication'
import { formatDateKey } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { fromOrdering, toOrdering } from '@/types/api'
import type { EmployeeListItem, EmployeeSortField } from '../schemas/employee.schema'
import { EmployeeStatusBadge } from './employee-status-badge'

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, EmployeeListItem>()

const fullName = (row: EmployeeListItem) => `${row.firstName} ${row.lastName}`

/** Column id → server ordering field, for the sortable columns. */
const SORT_FIELDS: Partial<Record<string, EmployeeSortField>> = {
  name: 'last_name',
  code: 'employee_code',
  joined: 'joining_date',
}

const columns = helper.columns([
  helper.display({
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          to={`/employees/${row.original.id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {fullName(row.original)}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  }),
  helper.display({
    id: 'code',
    header: 'Employee ID',
    cell: ({ row }) => <span className="tabular-nums">{row.original.employeeCode ?? '—'}</span>,
  }),
  helper.display({
    id: 'position',
    header: 'Department',
    cell: ({ row }) => (
      <div>
        <p>{row.original.departmentName ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{row.original.designationTitle ?? '—'}</p>
      </div>
    ),
  }),
  helper.display({ id: 'role', header: 'Role', cell: ({ row }) => ROLE_LABELS[row.original.role] }),
  helper.display({
    id: 'managers',
    header: 'Reports to',
    cell: ({ row }) =>
      row.original.managerNames.length > 0 ? row.original.managerNames.join(', ') : 'No manager',
  }),
  helper.display({
    id: 'joined',
    header: 'Joined',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateKey(row.original.joiningDate)}</span>
    ),
  }),
  helper.display({
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <EmployeeStatusBadge status={row.original.status} />,
  }),
])

type EmployeeTableProps = {
  rows: EmployeeListItem[]
  ordering: string | undefined
  onOrderingChange: (ordering: string | undefined) => void
}

export function EmployeeTable({ rows, ordering, onOrderingChange }: EmployeeTableProps) {
  const table = useTable({ features, columns, data: rows })
  const current = fromOrdering(ordering ?? 'last_name')

  function sortButton(columnId: string, label: string) {
    const field = SORT_FIELDS[columnId]
    if (!field) return label
    const active = current?.field === field
    const nextDirection = active && current?.direction === 'asc' ? 'desc' : 'asc'
    const Icon = !active ? ArrowUpDown : current?.direction === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => onOrderingChange(toOrdering(field, nextDirection))}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label}
        <Icon aria-hidden="true" className={cn('size-3.5', !active && 'opacity-50')} />
      </button>
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const field = SORT_FIELDS[header.column.id]
                  const sorted = field && current?.field === field ? current.direction : undefined
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : field
                              ? 'none'
                              : undefined
                      }
                    >
                      {sortButton(header.column.id, String(header.column.columnDef.header ?? ''))}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="align-top">
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y md:hidden" aria-label="Employees">
        {rows.map((row) => (
          <li key={row.id} className="space-y-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <Link
                to={`/employees/${row.id}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {fullName(row)}
              </Link>
              <EmployeeStatusBadge status={row.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {[row.designationTitle, row.departmentName].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[row.role]} · {row.employeeCode ?? 'No ID yet'} · Joined{' '}
              {formatDateKey(row.joiningDate)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
