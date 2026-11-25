// Attendance records (P4-T08, P4-T09, P4-T10…T12): team scope for managers, leads and PMs;
// the whole organization for HR, who can also correct records. Filters: dates, department, team,
// employee, Late-In / missing check-out / corrected. CSV export of the filtered rows.
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
import { useDepartments, useReportingLines, useTeams } from '@/features/organization'
import { downloadTextFile } from '@/lib/csv'
import { appDateKey, shiftDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { services } from '@/services/registry'
import { useAttendanceList } from '../api/use-attendance'
import { AttendanceRecordList } from '../components/attendance-record-list'
import { CorrectionDialog, CorrectionHistoryDialog } from '../components/correction-dialogs'
import { attendanceToCsv } from '../lib/attendance-export'
import {
  ATTENDANCE_FILTER_LABELS,
  ATTENDANCE_FILTERS,
  type AttendanceFilter,
  type AttendanceListQuery,
  type AttendanceRecord,
} from '../schemas/attendance.schema'

const PAGE_SIZES = [25, 50, 100] as const
const EXPORT_LIMIT = 5000

export function AttendanceRecordsPage() {
  const user = useCurrentUser()
  const isHr = user.role === 'hr_admin'
  // Captured once per visit (render must stay pure); the server decides what "today" means for records.
  const [today] = useState(() => appDateKey(new Date()))
  const [query, setQuery] = useState<AttendanceListQuery>({
    from: shiftDateKey(today, -6),
    to: today,
    page: 1,
    pageSize: 25,
  })
  const validRange = query.from <= query.to
  const list = useAttendanceList(validRange ? query : { ...query, from: query.to })
  const departments = useDepartments()
  const teams = useTeams()
  const people = useReportingLines()
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null)
  const [history, setHistory] = useState<AttendanceRecord | null>(null)
  const [exporting, setExporting] = useState(false)
  const ids = {
    from: useId(),
    to: useId(),
    department: useId(),
    team: useId(),
    employee: useId(),
    filter: useId(),
  }

  const update = (changes: Partial<AttendanceListQuery>) =>
    setQuery((q) => ({ ...q, page: 1, ...changes }))

  async function exportCsv() {
    setExporting(true)
    try {
      const all = await services.attendance.list({ ...query, page: 1, pageSize: EXPORT_LIMIT })
      downloadTextFile(
        `attendance-${query.from}-to-${query.to}.csv`,
        attendanceToCsv(all.results, today),
      )
      if (all.count > EXPORT_LIMIT)
        toast.info(
          `Only the first ${EXPORT_LIMIT} rows were exported. Narrow the filters to export the rest.`,
        )
    } catch (error) {
      toast.error(userMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isHr ? 'Attendance records' : 'Team attendance'}
        description={
          isHr
            ? 'Attendance across the organization. Corrections need a reason and are recorded.'
            : 'Attendance of the people in your reporting scope.'
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
          <Label htmlFor={ids.from}>From</Label>
          <Input
            id={ids.from}
            type="date"
            value={query.from}
            max={today}
            onChange={(e) => update({ from: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.to}>To</Label>
          <Input
            id={ids.to}
            type="date"
            value={query.to}
            max={today}
            aria-invalid={!validRange}
            onChange={(e) => update({ to: e.target.value })}
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
          <Label htmlFor={ids.team}>Team</Label>
          <NativeSelect
            id={ids.team}
            placeholder="All teams"
            value={query.teamId ?? ''}
            options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            onChange={(e) => update({ teamId: e.target.value || undefined })}
          />
        </div>
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
          <Label htmlFor={ids.filter}>Show</Label>
          <NativeSelect
            id={ids.filter}
            placeholder="All records"
            value={query.filter ?? ''}
            options={ATTENDANCE_FILTERS.map((f) => ({
              value: f,
              label: ATTENDANCE_FILTER_LABELS[f],
            }))}
            onChange={(e) =>
              update({ filter: (e.target.value || undefined) as AttendanceFilter | undefined })
            }
          />
        </div>
        {!validRange ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-6">
            The start date must be on or before the end date.
          </p>
        ) : null}
      </section>

      <section
        aria-label="Attendance list"
        aria-busy={list.isFetching}
        className="rounded-lg border bg-card shadow-xs"
      >
        {list.isPending ? (
          <>
            <span className="sr-only">Loading attendance…</span>
            <ListSkeleton rows={6} className="border-0" />
          </>
        ) : list.isError ? (
          <div className="p-4">
            <ErrorState
              title="Could not load attendance"
              message={userMessage(list.error)}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : list.data.results.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No attendance records"
              description="Try a different date range or filter."
            />
          </div>
        ) : (
          <>
            <AttendanceRecordList
              records={list.data.results}
              today={today}
              showEmployee
              caption="Attendance records"
              onCorrect={isHr ? setCorrecting : undefined}
              onHistory={setHistory}
            />
            <PaginationBar
              page={query.page}
              pageSize={query.pageSize}
              total={list.data.count}
              pageSizes={PAGE_SIZES}
              itemLabel="records"
              onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </>
        )}
      </section>

      {isHr ? <CorrectionDialog record={correcting} onClose={() => setCorrecting(null)} /> : null}
      <CorrectionHistoryDialog record={history} onClose={() => setHistory(null)} />
    </div>
  )
}
