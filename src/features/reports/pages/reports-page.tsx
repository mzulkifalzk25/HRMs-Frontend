// Reports (P8-T01…T10): attendance, Late-In, leave, employees, departments. Shared filters;
// data is scoped by the backend (HR: everyone; managers, leads and PMs: their scope).
import { CalendarClock, Clock, Timer, UserX, Users } from 'lucide-react'
import { useId, useState } from 'react'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { StatCard } from '@/components/shared/stat-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDuration } from '@/features/attendance/lib/policy'
import { useCurrentUser } from '@/features/authentication'
import { useDepartments, useReportingLines, useTeams } from '@/features/organization'
import { appDateKey, formatAppTime, formatDateKey, shiftDateKey } from '@/lib/datetime'
import { LEAVE_TYPE_LABELS, LEAVE_TYPES } from '@/types/hr'
import {
  useAttendanceReport,
  useDepartmentReport,
  useEmployeeReport,
  useLeaveReport,
} from '../api/use-reports'
import { BarReportChart, ReportState, ReportTable } from '../components/report-kit'
import type { ReportFilters } from '../schemas/report.schema'

const TABS = ['attendance', 'late', 'leave', 'employees', 'departments'] as const
type Tab = (typeof TABS)[number]
const TAB_LABELS: Record<Tab, string> = {
  attendance: 'Attendance',
  late: 'Late-In',
  leave: 'Leave',
  employees: 'Employees',
  departments: 'Departments',
}

export function ReportsPage() {
  const user = useCurrentUser()
  const isHr = user.role === 'hr_admin'
  const [today] = useState(() => appDateKey(new Date()))
  const [filters, setFilters] = useState<ReportFilters>({
    from: shiftDateKey(today, -29),
    to: today,
  })
  const [tab, setTab] = useState<Tab>('attendance')
  const departments = useDepartments()
  const teams = useTeams()
  const people = useReportingLines()
  const ids = { from: useId(), to: useId(), dept: useId(), team: useId(), emp: useId() }
  const valid = filters.from <= filters.to
  const set = (c: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...c }))
  const file = (name: string) => `${name}-${filters.from}-to-${filters.to}.csv`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={
          isHr
            ? 'Attendance, Late-In, leave and headcount across the organization. Late-In is tracking only.'
            : 'Reports for the people in your scope. Late-In is tracking only.'
        }
      />
      <section
        aria-label="Report filters"
        className="grid gap-3 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor={ids.from}>From</Label>
          <Input
            id={ids.from}
            type="date"
            value={filters.from}
            max={today}
            onChange={(e) => set({ from: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.to}>To</Label>
          <Input
            id={ids.to}
            type="date"
            value={filters.to}
            aria-invalid={!valid}
            onChange={(e) => set({ to: e.target.value })}
          />
        </div>
        {isHr ? (
          <div className="space-y-1.5">
            <Label htmlFor={ids.dept}>Department</Label>
            <NativeSelect
              id={ids.dept}
              placeholder="All departments"
              value={filters.departmentId ?? ''}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              onChange={(e) => set({ departmentId: e.target.value || undefined })}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor={ids.team}>Team</Label>
          <NativeSelect
            id={ids.team}
            placeholder="All teams"
            value={filters.teamId ?? ''}
            options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            onChange={(e) => set({ teamId: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.emp}>Employee</Label>
          <NativeSelect
            id={ids.emp}
            placeholder="Everyone"
            value={filters.employeeId ?? ''}
            options={(people.data ?? [])
              .filter((p) => p.id !== user.id)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => ({ value: p.id, label: p.name }))}
            onChange={(e) => set({ employeeId: e.target.value || undefined })}
          />
        </div>
        {!valid ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-5">
            The start date must be on or before the end date.
          </p>
        ) : null}
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="attendance">
          <AttendanceSection
            filters={filters}
            enabled={valid && tab === 'attendance'}
            file={file('attendance-report')}
          />
        </TabsContent>
        <TabsContent value="late">
          <LateSection
            filters={filters}
            enabled={valid && tab === 'late'}
            file={file('late-in-report')}
          />
        </TabsContent>
        <TabsContent value="leave">
          <LeaveSection
            filters={filters}
            enabled={valid && tab === 'leave'}
            file={file('leave-report')}
          />
        </TabsContent>
        <TabsContent value="employees">
          <EmployeeSection
            filters={filters}
            enabled={valid && tab === 'employees'}
            file={file('employee-report')}
          />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentSection
            filters={filters}
            enabled={valid && tab === 'departments'}
            file={file('department-report')}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type SectionProps = { filters: ReportFilters; enabled: boolean; file: string }

function AttendanceSection({ filters, enabled, file }: SectionProps) {
  const report = useAttendanceReport(filters, enabled)
  return (
    <ReportState query={report}>
      {(r) => (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="People" value={r.summary.people} icon={Users} />
            <StatCard
              label="Days recorded"
              value={r.summary.daysRecorded}
              icon={CalendarClock}
              tone="success"
            />
            <StatCard
              label="Late-In days"
              value={r.summary.lateDays}
              icon={Clock}
              tone="warning"
              hint="Tracking only"
            />
            <StatCard
              label="Average worked"
              value={r.summary.averageWorkedMs ? formatDuration(r.summary.averageWorkedMs) : '—'}
              icon={Timer}
              hint={`${r.summary.incompleteDays} missing check-outs`}
            />
          </div>
          <SectionCard title="Daily attendance">
            <BarReportChart
              title="People checked in and Late-In per day"
              data={r.byDay.map((d) => ({
                day: formatDateKey(d.date),
                present: d.present,
                late: d.late,
              }))}
              bars={[
                { key: 'present', label: 'Checked in', color: 'var(--chart-1)' },
                { key: 'late', label: 'Late-In', color: 'var(--chart-3)' },
              ]}
            />
          </SectionCard>
          <SectionCard title="By employee">
            <ReportTable
              caption="Attendance by employee"
              rows={r.byEmployee}
              fileName={file}
              empty="Nobody matches these filters."
              columns={[
                { label: 'Employee', value: (e) => e.name },
                { label: 'Department', value: (e) => e.departmentName ?? '' },
                { label: 'Days present', value: (e) => e.daysPresent, numeric: true },
                { label: 'Late-In', value: (e) => e.lateDays, numeric: true },
                { label: 'Missing check-out', value: (e) => e.incompleteDays, numeric: true },
                {
                  label: 'Worked',
                  value: (e) => e.workedMs,
                  render: (e) => formatDuration(e.workedMs),
                  numeric: true,
                },
              ]}
            />
          </SectionCard>
        </div>
      )}
    </ReportState>
  )
}

function LateSection({ filters, enabled, file }: SectionProps) {
  const report = useAttendanceReport(filters, enabled)
  return (
    <ReportState query={report}>
      {(r) => {
        const ranking = r.byEmployee
          .filter((e) => e.lateDays > 0)
          .sort((a, b) => b.lateDays - a.lateDays)
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Late-In check-ins"
                value={r.summary.lateDays}
                icon={Clock}
                tone="warning"
                hint="After 9:15 AM; tracking only"
              />
              <StatCard label="People with Late-In" value={ranking.length} icon={UserX} />
              <StatCard
                label="Share of recorded days"
                value={
                  r.summary.daysRecorded
                    ? `${Math.round((r.summary.lateDays / r.summary.daysRecorded) * 100)}%`
                    : '—'
                }
                icon={CalendarClock}
              />
            </div>
            <SectionCard title="Late-In by employee">
              <BarReportChart
                title="Late-In days per employee"
                data={ranking.slice(0, 12).map((e) => ({ employee: e.name, late: e.lateDays }))}
                bars={[{ key: 'late', label: 'Late-In days', color: 'var(--chart-3)' }]}
              />
            </SectionCard>
            <SectionCard title="Late-In check-ins">
              <ReportTable
                caption="Late-In check-ins"
                rows={r.lateArrivals}
                fileName={file}
                empty="No Late-In in this period."
                columns={[
                  { label: 'Date', value: (l) => l.date, render: (l) => formatDateKey(l.date) },
                  { label: 'Employee', value: (l) => l.name },
                  { label: 'Department', value: (l) => l.departmentName ?? '' },
                  {
                    label: 'Check-in (Pakistan time)',
                    value: (l) => formatAppTime(l.checkInAt, { seconds: true }),
                  },
                ]}
              />
            </SectionCard>
          </div>
        )
      }}
    </ReportState>
  )
}

function LeaveSection({ filters, enabled, file }: SectionProps) {
  const report = useLeaveReport(filters, enabled)
  return (
    <ReportState query={report}>
      {(r) => (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {r.byType.map((t) => (
              <StatCard
                key={t.leaveType}
                label={`${LEAVE_TYPE_LABELS[t.leaveType]}: approved days`}
                value={t.approvedDays}
                hint={`${t.pending} pending · ${t.declined} declined · ${t.cancelled} cancelled`}
              />
            ))}
          </div>
          <SectionCard
            title="Leave taken by employee"
            description="Approved working days inside the period"
          >
            <ReportTable
              caption="Leave by employee"
              rows={r.byEmployee}
              fileName={file}
              empty="Nobody matches these filters."
              columns={[
                { label: 'Employee', value: (e) => e.name },
                { label: 'Department', value: (e) => e.departmentName ?? '' },
                ...LEAVE_TYPES.map((t) => ({
                  label: `${LEAVE_TYPE_LABELS[t]} taken`,
                  value: (e: (typeof r.byEmployee)[number]) => e.approvedDays[t] ?? 0,
                  numeric: true,
                })),
                ...(r.byEmployee.some((e) => e.remaining)
                  ? LEAVE_TYPES.map((t) => ({
                      label: `${LEAVE_TYPE_LABELS[t]} left`,
                      value: (e: (typeof r.byEmployee)[number]) => e.remaining?.[t] ?? '',
                      numeric: true,
                    }))
                  : []),
              ]}
            />
          </SectionCard>
        </div>
      )}
    </ReportState>
  )
}

function EmployeeSection({ filters, enabled, file }: SectionProps) {
  const report = useEmployeeReport(filters, enabled)
  return (
    <ReportState query={report}>
      {(r) => (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="People" value={r.total} icon={Users} />
            <StatCard label="Joined in the period" value={r.joiners.length} tone="success" />
            <StatCard
              label="Inactive"
              value={r.byStatus.find((s) => s.label === 'Inactive')?.count ?? 0}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="By department">
              <BarReportChart
                title="People per department"
                data={r.byDepartment.map((d) => ({ department: d.label, people: d.count }))}
                bars={[{ key: 'people', label: 'People', color: 'var(--chart-1)' }]}
              />
            </SectionCard>
            <SectionCard title="By role">
              <ReportTable
                caption="People by role"
                rows={r.byRole}
                fileName={file.replace('employee', 'employees-by-role')}
                empty="Nobody matches these filters."
                columns={[
                  { label: 'Role', value: (x) => x.label },
                  { label: 'People', value: (x) => x.count, numeric: true },
                ]}
              />
            </SectionCard>
          </div>
          <SectionCard title="Joiners in the period">
            <ReportTable
              caption="Joiners"
              rows={r.joiners}
              fileName={file}
              empty="Nobody joined in this period."
              columns={[
                { label: 'Employee', value: (j) => j.name },
                { label: 'Department', value: (j) => j.departmentName ?? '' },
                {
                  label: 'Joining date',
                  value: (j) => j.joiningDate,
                  render: (j) => formatDateKey(j.joiningDate),
                },
              ]}
            />
          </SectionCard>
        </div>
      )}
    </ReportState>
  )
}

function DepartmentSection({ filters, enabled, file }: SectionProps) {
  const report = useDepartmentReport(filters, enabled)
  return (
    <ReportState query={report}>
      {(r) => (
        <div className="space-y-6">
          <SectionCard title="Departments">
            <BarReportChart
              title="Late-In and approved leave days per department"
              data={r.map((d) => ({
                department: d.name,
                late: d.lateDays,
                leave: d.approvedLeaveDays,
              }))}
              bars={[
                { key: 'late', label: 'Late-In days', color: 'var(--chart-3)' },
                { key: 'leave', label: 'Leave days', color: 'var(--chart-2)' },
              ]}
            />
          </SectionCard>
          <SectionCard title="Department and team overview">
            <ReportTable
              caption="Department report"
              rows={r}
              fileName={file}
              empty="No departments in your scope."
              columns={[
                { label: 'Department', value: (d) => d.name },
                { label: 'Headcount', value: (d) => d.headcount, numeric: true },
                {
                  label: 'Teams',
                  value: (d) => d.teams.map((t) => `${t.name} (${t.members})`).join(', ') || '—',
                },
                { label: 'Days recorded', value: (d) => d.daysRecorded, numeric: true },
                { label: 'Late-In days', value: (d) => d.lateDays, numeric: true },
                { label: 'Approved leave days', value: (d) => d.approvedLeaveDays, numeric: true },
              ]}
            />
          </SectionCard>
        </div>
      )}
    </ReportState>
  )
}
