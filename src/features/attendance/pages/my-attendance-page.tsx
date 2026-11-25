// My attendance (P4-T04…T07, P4-T12): check-in/out, own history with a date range, month calendar,
// CSV export. Every role checks in and sees only their own records here (D-044).
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useId, useState } from 'react'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { downloadTextFile } from '@/lib/csv'
import { appDateKey, shiftDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { useMyAttendance } from '../api/use-attendance'
import { AttendanceCalendar } from '../components/attendance-calendar'
import { AttendanceRecordList } from '../components/attendance-record-list'
import { CheckInCard } from '../components/check-in-card'
import { attendanceToCsv } from '../lib/attendance-export'

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function lastDayOf(month: string) {
  return shiftDateKey(`${shiftMonth(month, 1)}-01`, -1)
}

export function MyAttendancePage() {
  // Captured once per visit (render must stay pure); the server decides what "today" means for records.
  const [today] = useState(() => appDateKey(new Date()))
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const fromId = useId()
  const toId = useId()
  const validRange = Boolean(from && to && from <= to)
  const history = useMyAttendance(validRange ? from : today, validRange ? to : today)
  const calendar = useMyAttendance(`${month}-01`, lastDayOf(month))

  return (
    <div className="space-y-6">
      <PageHeader
        title="My attendance"
        description="Check in and out, and review your own attendance. Times are Pakistan time."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Today" className="lg:col-span-1">
          <CheckInCard />
        </SectionCard>

        <Tabs defaultValue="history" className="lg:col-span-2">
          <TabsList>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <SectionCard
              title="History"
              contentClassName="p-0"
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!history.data?.length}
                  onClick={() =>
                    history.data &&
                    downloadTextFile(
                      `my-attendance-${from}-to-${to}.csv`,
                      attendanceToCsv(history.data, today),
                    )
                  }
                >
                  <Download aria-hidden="true" />
                  Export CSV
                </Button>
              }
            >
              <div className="flex flex-wrap items-end gap-3 border-b p-4">
                <div className="space-y-1.5">
                  <Label htmlFor={fromId}>From</Label>
                  <Input
                    id={fromId}
                    type="date"
                    value={from}
                    max={today}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={toId}>To</Label>
                  <Input
                    id={toId}
                    type="date"
                    value={to}
                    max={today}
                    onChange={(e) => setTo(e.target.value)}
                    aria-invalid={!validRange}
                  />
                </div>
                {!validRange ? (
                  <p role="alert" className="text-sm text-destructive">
                    The start date must be on or before the end date.
                  </p>
                ) : null}
              </div>
              {history.isPending ? (
                <ListSkeleton rows={5} className="border-0" />
              ) : history.isError ? (
                <div className="p-4">
                  <ErrorState
                    title="Could not load your attendance"
                    message={userMessage(history.error)}
                    onRetry={() => void history.refetch()}
                  />
                </div>
              ) : history.data.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No attendance in this period"
                    description="Choose another date range."
                  />
                </div>
              ) : (
                <AttendanceRecordList
                  records={history.data}
                  today={today}
                  caption="My attendance history"
                />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="calendar">
            <SectionCard
              title={monthLabel(month)}
              actions={
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Previous month"
                    onClick={() => setMonth(shiftMonth(month, -1))}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Next month"
                    disabled={month >= today.slice(0, 7)}
                    onClick={() => setMonth(shiftMonth(month, 1))}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              }
            >
              {calendar.isPending ? (
                <ListSkeleton rows={4} />
              ) : calendar.isError ? (
                <ErrorState
                  message={userMessage(calendar.error)}
                  onRetry={() => void calendar.refetch()}
                />
              ) : (
                <AttendanceCalendar month={month} records={calendar.data} today={today} />
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
