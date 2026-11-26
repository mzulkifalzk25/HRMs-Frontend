// Leave application (P5-T06, D-063, D-088, D-089): type, dates, working-day duration, reason,
// optional attachment and manager selection where applicable. Shows who decides, who may review
// and that HR is always notified. The backend validates everything again.
import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { CheckboxList } from '@/components/forms/checkbox-list'
import { FormField } from '@/components/forms/form-field'
import { NativeSelect } from '@/components/forms/native-select'
import { applyServerErrors } from '@/components/forms/server-errors'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { appDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { dateKeySchema, LEAVE_TYPE_LABELS } from '@/types/hr'
import { useLeaveBalances, useRoutePreview, useSubmitLeave } from '../api/use-leave'
import { ParticipantsPanel } from '../components/participants-panel'
import { balanceOf } from '../lib/balance'
import { leaveDays } from '../lib/duration'
import { days, fileSize, ROUTE_LABELS } from '../lib/leave-labels'
import { LEAVE_ATTACHMENT_RULES, leaveYearOf } from '../lib/leave-policy'
import {
  leaveApplicationFormSchema,
  leaveTypeOptions,
  type LeaveApplicationFormValues,
  type LeaveApplicationInput,
} from '../schemas/leave.schema'

const isDateKey = (value: string) => dateKeySchema.safeParse(value).success

const FIELDS = ['leaveType', 'startDate', 'endDate', 'reason', 'managerIds', 'attachment'] as const

export function ApplyLeavePage() {
  const navigate = useNavigate()
  const [today] = useState(() => appDateKey(new Date()))
  const year = leaveYearOf(today)
  const balances = useLeaveBalances(null, year)
  const submitLeave = useSubmitLeave()
  const attachmentId = useId()
  const form = useForm<LeaveApplicationFormValues, unknown, LeaveApplicationInput>({
    resolver: zodResolver(leaveApplicationFormSchema),
    defaultValues: {
      leaveType: '',
      startDate: today,
      endDate: today,
      reason: '',
      managerIds: [],
      attachment: null,
    },
  })
  const errors = form.formState.errors
  const [leaveType, startDate, endDate, managerIds, attachment] = useWatch({
    control: form.control,
    name: ['leaveType', 'startDate', 'endDate', 'managerIds', 'attachment'],
  })
  // First load: the server's default (all managers); afterwards the user's selection.
  const [touchedManagers, setTouchedManagers] = useState(false)
  const route = useRoutePreview(touchedManagers ? managerIds : null)
  const choices = route.data?.managerChoices ?? []
  const selected = touchedManagers ? managerIds : choices.map((c) => c.id)

  const validDates = isDateKey(startDate) && isDateKey(endDate) && endDate >= startDate
  const requested = validDates ? leaveDays(startDate, endDate) : 0
  const balance = leaveType && balances.data ? balanceOf(balances.data, leaveType) : null
  const overBalance = balance !== null && requested > balance.remaining

  const submit = form.handleSubmit(async (input) => {
    if (balance && input.requestedDays > balance.remaining) {
      form.setError('leaveType', {
        message: `Only ${days(balance.remaining)} of ${LEAVE_TYPE_LABELS[input.leaveType]} leave remain.`,
      })
      return
    }
    try {
      const created = await submitLeave.mutateAsync({
        ...input,
        managerIds: route.data?.routedTo === 'managers' ? selected : [],
      })
      toast.success('Leave request submitted. HR has been notified.')
      void navigate(`/leave/requests/${created.id}`)
    } catch (error) {
      form.setError('root', { message: applyServerErrors(error, form.setError, FIELDS) })
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for leave"
        description="Leave days count Monday to Friday. Whole days only."
      />
      <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Request" className="lg:col-span-2">
          <div className="space-y-4">
            <FormField
              label="Leave type"
              error={errors.leaveType?.message}
              hint={
                balance
                  ? overBalance
                    ? `This request needs ${days(requested)}, but only ${days(balance.remaining)} remain.`
                    : `${days(balance.remaining)} left${requested > 0 ? `, ${days(balance.remaining - requested)} after this request` : ''}.`
                  : undefined
              }
            >
              {(c) => (
                <NativeSelect
                  {...c}
                  placeholder="Choose a leave type"
                  options={leaveTypeOptions(balances.data)}
                  {...form.register('leaveType')}
                />
              )}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start date" error={errors.startDate?.message}>
                {(c) => <Input {...c} type="date" {...form.register('startDate')} />}
              </FormField>
              <FormField label="End date" error={errors.endDate?.message}>
                {(c) => <Input {...c} type="date" {...form.register('endDate')} />}
              </FormField>
            </div>
            <p aria-live="polite" className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              Duration:{' '}
              <span className="font-medium">
                {validDates ? `${days(requested)} (working days)` : 'choose valid dates'}
              </span>
              {validDates && startDate < today ? (
                <span className="text-muted-foreground"> · starts in the past (backdated)</span>
              ) : null}
            </p>
            <FormField label="Reason" error={errors.reason?.message}>
              {(c) => (
                <Textarea
                  {...c}
                  rows={3}
                  placeholder="For example: family wedding"
                  {...form.register('reason')}
                />
              )}
            </FormField>
            <div className="space-y-1.5">
              <label htmlFor={attachmentId} className="text-sm font-medium">
                Attachment (optional)
              </label>
              <Input
                id={attachmentId}
                type="file"
                accept={LEAVE_ATTACHMENT_RULES.extensions.join(',')}
                aria-invalid={Boolean(errors.attachment)}
                aria-describedby={`${attachmentId}-hint`}
                onChange={(e) =>
                  form.setValue('attachment', e.target.files?.[0] ?? null, {
                    shouldValidate: true,
                  })
                }
              />
              <p id={`${attachmentId}-hint`} className="text-xs text-muted-foreground">
                {attachment
                  ? `${attachment.name} (${fileSize(attachment.size)})`
                  : LEAVE_ATTACHMENT_RULES.label}
              </p>
              {errors.attachment?.message ? (
                <p className="text-sm text-destructive">{errors.attachment.message}</p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Who is involved"
            description={route.data ? `Goes to: ${ROUTE_LABELS[route.data.routedTo]}` : undefined}
          >
            {route.isPending ? (
              <CardSkeleton lines={2} />
            ) : route.isError ? (
              <ErrorState message={userMessage(route.error)} onRetry={() => void route.refetch()} />
            ) : (
              <div className="space-y-4">
                {route.data.routedTo === 'managers' && choices.length > 1 ? (
                  <CheckboxList
                    legend="Send to these managers"
                    hint="Any one of them can decide."
                    options={choices.map((m) => ({ value: m.id, label: m.name }))}
                    value={selected}
                    error={errors.managerIds?.message}
                    onChange={(next) => {
                      setTouchedManagers(true)
                      form.setValue('managerIds', next)
                    }}
                  />
                ) : null}
                <ParticipantsPanel participants={route.data.participants} />
                {route.data.problem ? (
                  <p role="alert" className="text-sm text-destructive">
                    {route.data.problem}
                  </p>
                ) : null}
              </div>
            )}
          </SectionCard>
          {errors.root?.message ? (
            <p
              role="alert"
              className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground"
            >
              {errors.root.message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || Boolean(route.data?.problem)}
            >
              {form.formState.isSubmitting ? 'Submitting…' : 'Submit request'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void navigate('/leave')}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
