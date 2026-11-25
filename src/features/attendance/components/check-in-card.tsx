// Check-in / check-out (P4-T04). The server records the actual time (the client sends none) and
// classifies it in Asia/Karachi. One session per day (provisional, Q-ATT-03). Buttons are disabled
// while a request runs (no double submits) and while offline. No location is recorded (Q-ATT-07).
import { LogIn, LogOut, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/use-now'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatAppTime, formatDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { useCheckIn, useCheckOut, useTodayAttendance } from '../api/use-attendance'
import { formatDuration, sessionState } from '../lib/policy'
import { AttendanceBadges } from './attendance-badges'

export function CheckInCard() {
  const today = useTodayAttendance()
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const now = useNow()
  const online = useOnlineStatus()

  if (today.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading today’s attendance…</span>
        <CardSkeleton lines={3} />
      </div>
    )
  }
  if (today.isError) {
    return (
      <ErrorState
        title="Could not load today’s attendance"
        message={userMessage(today.error)}
        onRetry={() => void today.refetch()}
      />
    )
  }

  const { date, record } = today.data
  const state = record ? sessionState(record, date) : 'not_checked_in'
  const busy = checkIn.isPending || checkOut.isPending
  // Display-only live counter. Clamped at 0: the device clock may run slightly behind the server's
  // recorded check-in time, and a negative value must never crash the card.
  const liveDuration =
    record?.checkInAt && !record.checkOutAt
      ? Math.max(0, now.getTime() - new Date(record.checkInAt).getTime())
      : null

  const onError = (error: unknown) => toast.error(userMessage(error))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{formatDateKey(date)}</p>
          <p
            className="text-3xl font-semibold tabular-nums"
            aria-label={`Current time in Pakistan ${formatAppTime(now, { seconds: true })}`}
          >
            {formatAppTime(now, { seconds: true })}
          </p>
          <p className="text-xs text-muted-foreground">Pakistan time (Asia/Karachi)</p>
        </div>
        {record ? <AttendanceBadges record={record} today={date} /> : null}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-muted/60 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Check-in</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {record?.checkInAt ? formatAppTime(record.checkInAt, { seconds: true }) : '—'}
          </dd>
        </div>
        <div className="rounded-md bg-muted/60 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Check-out</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {record?.checkOutAt ? formatAppTime(record.checkOutAt, { seconds: true }) : '—'}
          </dd>
        </div>
        <div className="rounded-md bg-muted/60 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Worked</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {record?.durationMs != null
              ? formatDuration(record.durationMs)
              : liveDuration != null
                ? formatDuration(liveDuration)
                : '—'}
          </dd>
        </div>
      </dl>

      {!online ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground"
        >
          <WifiOff aria-hidden="true" className="size-4" />
          You are offline. Check-in and check-out need a connection.
        </p>
      ) : null}

      {state === 'not_checked_in' ? (
        <Button
          size="lg"
          className="w-full"
          disabled={busy || !online}
          onClick={() =>
            checkIn.mutate(undefined, {
              onError,
              onSuccess: (r) => toast.success(`Checked in at ${formatAppTime(r.checkInAt ?? '')}.`),
            })
          }
        >
          <LogIn aria-hidden="true" />
          {checkIn.isPending ? 'Checking in…' : 'Check in'}
        </Button>
      ) : state === 'in_progress' ? (
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          disabled={busy || !online}
          onClick={() =>
            checkOut.mutate(undefined, {
              onError,
              onSuccess: (r) =>
                toast.success(`Checked out at ${formatAppTime(r.checkOutAt ?? '')}.`),
            })
          }
        >
          <LogOut aria-hidden="true" />
          {checkOut.isPending ? 'Checking out…' : 'Check out'}
        </Button>
      ) : (
        <p
          role="status"
          className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success-subtle-foreground"
        >
          You have checked out for today. See you tomorrow.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Office hours: check-in from 9:00 AM (on time until 9:15 AM), check-out from 5:45 PM. Late-In
        is recorded for tracking only.
      </p>
    </div>
  )
}
