// Leave records (P5-T14, P5-T10 HR monitoring): HR sees every request; managers, leads and PMs
// their scope and the requests they take part in. Filters: status, type, department (HR),
// employee, dates (overlapping). Paginated; CSV export of the filtered rows.
import { Download } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { PaginationBar } from '@/components/tables/pagination-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentUser } from '@/features/authentication'
import { useDepartments, useReportingLines } from '@/features/organization'
import { downloadTextFile } from '@/lib/csv'
import { userMessage } from '@/services/api'
import { services } from '@/services/registry'
import {
  LEAVE_STATUS_LABELS,
  LEAVE_STATUSES,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPES,
  type LeaveStatus,
  type LeaveType,
} from '@/types/hr'
import { useLeaveList } from '../api/use-leave'
import { LeaveRequestList } from '../components/leave-request-list'
import { leaveToCsv } from '../lib/leave-export'
import type { LeaveListQuery } from '../schemas/leave.schema'

const PAGE_SIZES = [25, 50, 100] as const
const EXPORT_LIMIT = 5000

export function LeaveRecordsPage() {
  const user = useCurrentUser()
  const isHr = user.role === 'hr_admin'
  const [query, setQuery] = useState<LeaveListQuery>({ page: 1, pageSize: 25 })
  const validRange = !query.from || !query.to || query.from <= query.to
  const list = useLeaveList(validRange ? query : { ...query, to: undefined })
  const departments = useDepartments()
  const people = useReportingLines()
  const [exporting, setExporting] = useState(false)
  const ids = {
    status: useId(),
    type: useId(),
    department: useId(),
    employee: useId(),
    from: useId(),
    to: useId(),
  }
  const update = (changes: Partial<LeaveListQuery>) =>
    setQuery((q) => ({ ...q, page: 1, ...changes }))

  async function exportCsv() {
    setExporting(true)
    try {
      const all = await services.leave.list({ ...query, page: 1, pageSize: EXPORT_LIMIT })
      downloadTextFile('leave-requests.csv', leaveToCsv(all.results))
      if (all.count > EXPORT_LIMIT)
        toast.info(`Only the first ${EXPORT_LIMIT} rows were exported. Narrow the filters.`)
    } catch (error) {
      toast.error(userMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isHr ? 'Leave records' : 'Team leave'}
        description={
          isHr
            ? 'Every leave request in the organization. HR can decide any pending request with a reason.'
            : 'Leave requests of the people in your scope and the ones you take part in.'
        }
        actions={
          <Button
            variant="outline"
            onClick={() => void exportCsv()}
            disabled={exporting || !list.data?.count}
          >
            <Download aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />
      <section
        aria-label="Filters"
        className="grid gap-3 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor={ids.status}>Status</Label>
          <NativeSelect
            id={ids.status}
            placeholder="All statuses"
            value={query.status ?? ''}
            options={LEAVE_STATUSES.filter((s) => s !== 'draft').map((s) => ({
              value: s,
              label: LEAVE_STATUS_LABELS[s],
            }))}
            onChange={(e) => update({ status: (e.target.value || undefined) as LeaveStatus })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.type}>Type</Label>
          <NativeSelect
            id={ids.type}
            placeholder="All types"
            value={query.leaveType ?? ''}
            options={LEAVE_TYPES.map((t) => ({ value: t, label: LEAVE_TYPE_LABELS[t] }))}
            onChange={(e) => update({ leaveType: (e.target.value || undefined) as LeaveType })}
          />
        </div>
        {isHr ? (
          <div className="space-y-1.5">
            <Label htmlFor={ids.department}>Department</Label>
            <NativeSelect
              id={ids.department}
              placeholder="All departments"
              value={query.departmentId ?? ''}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              onChange={(e) => update({ departmentId: e.target.value || undefined })}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor={ids.employee}>Employee</Label>
          <NativeSelect
            id={ids.employee}
            placeholder="Everyone"
            value={query.employeeId ?? ''}
            options={(people.data ?? [])
              .filter((p) => p.id !== user.id)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => ({ value: p.id, label: p.name }))}
            onChange={(e) => update({ employeeId: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.from}>From</Label>
          <Input
            id={ids.from}
            type="date"
            value={query.from ?? ''}
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.to}>To</Label>
          <Input
            id={ids.to}
            type="date"
            value={query.to ?? ''}
            aria-invalid={!validRange}
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>
        {!validRange ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-6">
            The start date must be on or before the end date.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Leave requests"
        aria-busy={list.isFetching}
        className="rounded-lg border bg-card shadow-xs"
      >
        {list.isPending ? (
          <>
            <span className="sr-only">Loading leave requests…</span>
            <ListSkeleton rows={6} className="border-0" />
          </>
        ) : list.isError ? (
          <div className="p-4">
            <ErrorState
              title="Could not load leave requests"
              message={userMessage(list.error)}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : list.data.results.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No leave requests" description="Try different filters." />
          </div>
        ) : (
          <>
            <LeaveRequestList requests={list.data.results} caption="Leave requests" />
            <PaginationBar
              page={query.page}
              pageSize={query.pageSize}
              total={list.data.count}
              pageSizes={PAGE_SIZES}
              itemLabel="requests"
              onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </>
        )}
      </section>
    </div>
  )
}
