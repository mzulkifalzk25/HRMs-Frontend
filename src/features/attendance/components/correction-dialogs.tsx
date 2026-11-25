// HR attendance correction (P4-T10) and its audit history (P4-T11).
// Mandatory reason (D-058). Times are Pakistan times on the record's own date (same-day session,
// provisional Q-ATT-03). Shows before → after before saving.
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { FormField } from '@/components/forms/form-field'
import { applyServerErrors } from '@/components/forms/server-errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { appTimeKey, formatAppDateTime, formatAppTime, formatDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { useAttendanceCorrections, useCorrectAttendance } from '../api/use-attendance'
import {
  correctionFormSchema,
  type AttendanceRecord,
  type CorrectionFormValues,
  type CorrectionInput,
} from '../schemas/attendance.schema'

const show = (value: string | null) => (value ? formatAppTime(value, { seconds: true }) : 'none')

export function CorrectionDialog({
  record,
  onClose,
}: {
  record: AttendanceRecord | null
  onClose: () => void
}) {
  return (
    <Dialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {record ? <CorrectionForm key={record.id} record={record} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CorrectionForm({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) {
  const correct = useCorrectAttendance()
  const form = useForm<CorrectionFormValues, unknown, CorrectionInput>({
    resolver: zodResolver(correctionFormSchema(record.date)),
    defaultValues: {
      checkIn: record.checkInAt ? appTimeKey(record.checkInAt) : '',
      checkOut: record.checkOutAt ? appTimeKey(record.checkOutAt) : '',
      reason: '',
    },
  })
  const errors = form.formState.errors
  const [checkIn, checkOut] = useWatch({ control: form.control, name: ['checkIn', 'checkOut'] })

  const submit = form.handleSubmit(async (input) => {
    try {
      await correct.mutateAsync({ id: record.id, input })
      toast.success('Attendance corrected. The change is recorded in the history.')
      onClose()
    } catch (error) {
      const mapped = applyServerErrors(error, form.setError, ['reason'])
      // Server field names are checkInAt/checkOutAt; show them on the matching inputs.
      const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {}
      if (fieldErrors.checkInAt?.[0])
        form.setError('checkIn', { message: fieldErrors.checkInAt[0] })
      if (fieldErrors.checkOutAt?.[0])
        form.setError('checkOut', { message: fieldErrors.checkOutAt[0] })
      form.setError('root', {
        message:
          fieldErrors.checkInAt || fieldErrors.checkOutAt
            ? 'Please correct the highlighted fields.'
            : mapped,
      })
    }
  })

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Correct attendance</DialogTitle>
        <DialogDescription>
          {record.employeeName} · {formatDateKey(record.date)}. Times are Pakistan time. The
          original times and your reason are kept in the history.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Check-in" error={errors.checkIn?.message}>
          {(c) => <Input {...c} type="time" step={1} {...form.register('checkIn')} />}
        </FormField>
        <FormField
          label="Check-out"
          error={errors.checkOut?.message}
          hint="Leave empty if there was no check-out."
        >
          {(c) => <Input {...c} type="time" step={1} {...form.register('checkOut')} />}
        </FormField>
      </div>
      <div aria-live="polite" className="rounded-md bg-muted/60 p-3 text-sm">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Change</p>
        <p className="flex flex-wrap items-center gap-2 tabular-nums">
          In {show(record.checkInAt)} <ArrowRight aria-label="becomes" className="size-3.5" />{' '}
          {checkIn || 'none'}
        </p>
        <p className="flex flex-wrap items-center gap-2 tabular-nums">
          Out {show(record.checkOutAt)} <ArrowRight aria-label="becomes" className="size-3.5" />{' '}
          {checkOut || 'none'}
        </p>
      </div>
      <FormField label="Reason (required)" error={errors.reason?.message}>
        {(c) => (
          <Textarea
            {...c}
            rows={3}
            placeholder="For example: biometric device was offline"
            {...form.register('reason')}
          />
        )}
      </FormField>
      {errors.root?.message ? (
        <p
          role="alert"
          className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground"
        >
          {errors.root.message}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : 'Save correction'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CorrectionHistoryDialog({
  record,
  onClose,
}: {
  record: AttendanceRecord | null
  onClose: () => void
}) {
  const history = useAttendanceCorrections(record?.id ?? null)
  return (
    <Dialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Correction history</DialogTitle>
          <DialogDescription>
            {record ? `${record.employeeName} · ${formatDateKey(record.date)}` : ''}
          </DialogDescription>
        </DialogHeader>
        {history.isPending ? (
          <ListSkeleton rows={2} />
        ) : history.isError ? (
          <ErrorState message={userMessage(history.error)} onRetry={() => void history.refetch()} />
        ) : history.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No corrections recorded.</p>
        ) : (
          <ol className="space-y-3">
            {history.data.map((entry) => (
              <li key={entry.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {entry.actorName} · <time dateTime={entry.at}>{formatAppDateTime(entry.at)}</time>
                </p>
                <p className="mt-1">Reason: {entry.reason}</p>
                <p className="mt-1 text-muted-foreground tabular-nums">
                  In: {show(entry.before.checkInAt)} → {show(entry.after.checkInAt)} · Out:{' '}
                  {show(entry.before.checkOutAt)} → {show(entry.after.checkOutAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
