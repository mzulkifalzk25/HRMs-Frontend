// Settings (P8-T11…T16), HR only. Editable: company details, default leave allocation (D-062),
// company holidays (skipped in leave duration, D-088) and the approval options D-067/D-089 allow.
// Shown read-only: the confirmed attendance policy (Q-SET-01 open), working days (D-088, D-093)
// and the routing rules (D-066, D-089). Every change is recorded in the audit log.
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Trash2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { FormField } from '@/components/forms/form-field'
import { NativeSelect } from '@/components/forms/native-select'
import { applyServerErrors } from '@/components/forms/server-errors'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ATTENDANCE_POLICY } from '@/features/attendance/lib/policy'
import { appDateKey, formatAppDateTime, formatDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { LEAVE_TYPE_LABELS, LEAVE_TYPES, type LeaveType } from '@/types/hr'
import { useSettings, useSettingsMutation } from '../api/use-settings'
import {
  companyFormSchema,
  DECISION_RULE_LABELS,
  DECISION_RULES,
  holidayFormSchema,
  type DecisionRule,
  type Holiday,
  type Settings,
} from '../schemas/settings.schema'

function ReadOnly({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-4 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock aria-hidden="true" className="size-3.5" />
        Confirmed policy: shown, not editable here
      </p>
      {children}
    </div>
  )
}

const to12h = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const minus = (hhmm: string, minutes: number) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  const t = h * 60 + m - minutes
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const plus = (hhmm: string, minutes: number) => minus(hhmm, -minutes)

export function SettingsPage() {
  const settings = useSettings()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={
          settings.data?.updatedAt
            ? `Last changed ${formatAppDateTime(settings.data.updatedAt)} by ${settings.data.updatedByName}. Every change is recorded in the audit log.`
            : 'Company-wide settings. Every change is recorded in the audit log.'
        }
      />
      {settings.isPending ? (
        <CardSkeleton lines={5} />
      ) : settings.isError ? (
        <ErrorState message={userMessage(settings.error)} onRetry={() => void settings.refetch()} />
      ) : (
        <Tabs defaultValue="company">
          <TabsList className="flex-wrap">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="attendance">Attendance policy</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="calendar">Working days and holidays</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
          </TabsList>
          <TabsContent value="company">
            <CompanyTab settings={settings.data} />
          </TabsContent>
          <TabsContent value="attendance">
            <AttendanceTab />
          </TabsContent>
          <TabsContent value="leave">
            <LeaveTab
              key={JSON.stringify(settings.data.defaultAllocation)}
              settings={settings.data}
            />
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarTab settings={settings.data} />
          </TabsContent>
          <TabsContent value="approvals">
            <ApprovalsTab key={JSON.stringify(settings.data.approvals)} settings={settings.data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function CompanyTab({ settings }: { settings: Settings }) {
  const save = useSettingsMutation((svc, input: Parameters<typeof svc.updateCompany>[0]) =>
    svc.updateCompany(input),
  )
  const { timezone: _tz, ...defaults } = settings.company
  const form = useForm({ resolver: zodResolver(companyFormSchema), defaultValues: defaults })
  const e = form.formState.errors
  const submit = form.handleSubmit(async (input) => {
    try {
      await save.mutateAsync(input)
      form.reset(input)
      toast.success('Company information saved.')
    } catch (error) {
      toast.error(applyServerErrors(error, form.setError, Object.keys(defaults)))
    }
  })
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard title="Company information" className="lg:col-span-2">
        <form noValidate onSubmit={(ev) => void submit(ev)} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Company name" error={e.companyName?.message}>
            {(c) => <Input {...c} {...form.register('companyName')} />}
          </FormField>
          <FormField label="Legal name" error={e.legalName?.message}>
            {(c) => <Input {...c} {...form.register('legalName')} />}
          </FormField>
          <FormField label="HR contact email" error={e.contactEmail?.message}>
            {(c) => <Input {...c} type="email" {...form.register('contactEmail')} />}
          </FormField>
          <FormField label="Phone" error={e.phone?.message}>
            {(c) => <Input {...c} {...form.register('phone')} />}
          </FormField>
          <FormField label="Address" error={e.address?.message} className="sm:col-span-2">
            {(c) => <Textarea {...c} rows={2} {...form.register('address')} />}
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save company information'}
            </Button>
          </div>
        </form>
      </SectionCard>
      <SectionCard title="Organization">
        <ReadOnly>
          <p>Time zone: Asia/Karachi (Pakistan time) for every policy decision.</p>
          <p>Single company (provisional).</p>
        </ReadOnly>
        <p className="mt-3 text-sm">
          Departments, designations, teams and projects are managed on the{' '}
          <Link to="/organization" className="text-primary underline-offset-4 hover:underline">
            Organization
          </Link>{' '}
          page.
        </p>
      </SectionCard>
    </div>
  )
}

function AttendanceTab() {
  const p = ATTENDANCE_POLICY
  return (
    <SectionCard
      title="Attendance policy"
      description="Whether these values become editable is still open (Q-SET-01)."
    >
      <ReadOnly>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Official check-in {to12h(p.officialCheckIn)}; on time until{' '}
            {to12h(plus(p.officialCheckIn, p.graceMinutes))} inclusive; later is Late-In (tracking
            only, never payroll).
          </li>
          <li>
            Official check-out {to12h(p.officialCheckOut)}; check-out from{' '}
            {to12h(minus(p.officialCheckOut, p.checkoutAllowanceMinutes))} has no early-departure
            flag. Earlier check-outs: policy not decided.
          </li>
          <li>
            Working time = actual check-out − actual check-in, to the second; no rounding, no break
            deduction.
          </li>
          <li>
            One session per day; a forgotten check-out stays open and is flagged (provisional).
          </li>
          <li>Corrections: HR only, with a reason, recorded in the history and audit log.</li>
        </ul>
      </ReadOnly>
    </SectionCard>
  )
}

function LeaveTab({ settings }: { settings: Settings }) {
  const save = useSettingsMutation((svc, input: Record<LeaveType, number>) =>
    svc.updateAllocation(input),
  )
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        LEAVE_TYPES.map((t) => [t, String(settings.defaultAllocation[t])]),
      ) as Record<LeaveType, string>,
  )
  const [errors, setErrors] = useState<Partial<Record<LeaveType, string>>>({})
  const idPrefix = useId()
  async function submit() {
    const next: Partial<Record<LeaveType, string>> = {}
    for (const t of LEAVE_TYPES) {
      const n = Number(values[t])
      if (values[t].trim() === '' || !Number.isInteger(n) || n < 0 || n > 365)
        next[t] = 'Enter whole days from 0 to 365.'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    try {
      await save.mutateAsync(
        Object.fromEntries(LEAVE_TYPES.map((t) => [t, Number(values[t])])) as Record<
          LeaveType,
          number
        >,
      )
      toast.success('Default allocation saved.')
    } catch (error) {
      toast.error(userMessage(error))
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard
        title="Default annual allocation"
        description="Days per category for an employee’s first allocation in a leave year"
        className="lg:col-span-2"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {LEAVE_TYPES.map((t) => (
              <div key={t} className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-${t}`}>{LEAVE_TYPE_LABELS[t]}</Label>
                <Input
                  id={`${idPrefix}-${t}`}
                  inputMode="numeric"
                  value={values[t]}
                  aria-invalid={Boolean(errors[t])}
                  onChange={(e) => setValues({ ...values, [t]: e.target.value })}
                />
                {errors[t] ? <p className="text-xs text-destructive">{errors[t]}</p> : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Existing balances are not changed. To change one person’s balance, use{' '}
            <Link to="/leave/balances" className="text-primary underline-offset-4 hover:underline">
              Leave balances
            </Link>
            .
          </p>
          <Button onClick={() => void submit()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save allocation'}
          </Button>
        </div>
      </SectionCard>
      <SectionCard title="Leave rules">
        <ReadOnly>
          <ul className="list-disc space-y-1 pl-5">
            <li>Separate balances per category; only approved leave deducts.</li>
            <li>No negative balances; no overlapping requests; backdating allowed.</li>
            <li>Whole days only; Monday–Friday, holidays excluded.</li>
            <li>
              Approved leave can be cancelled by the requester until the day before it starts.
            </li>
            <li>
              Leave year, proration and carry-forward: not decided yet (calendar year, no proration
              or carry-forward for now).
            </li>
          </ul>
        </ReadOnly>
      </SectionCard>
    </div>
  )
}

function CalendarTab({ settings }: { settings: Settings }) {
  const add = useSettingsMutation((svc, input: { date: string; name: string }) =>
    svc.addHoliday(input),
  )
  const remove = useSettingsMutation((svc, id: string) => svc.removeHoliday(id))
  const [removing, setRemoving] = useState<Holiday | null>(null)
  const [today] = useState(() => appDateKey(new Date()))
  const form = useForm({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: '', name: '' },
  })
  const e = form.formState.errors
  const submit = form.handleSubmit(async (input) => {
    try {
      await add.mutateAsync(input)
      form.reset({ date: '', name: '' })
      toast.success('Holiday added. Leave requests no longer count it.')
    } catch (error) {
      form.setError('root', { message: applyServerErrors(error, form.setError, ['date', 'name']) })
    }
  })
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard
        title="Company holidays"
        description="Leave days skip these dates (D-088). Other effects (attendance, reminders) are not decided yet."
        className="lg:col-span-2"
      >
        <div className="space-y-4">
          <form
            noValidate
            onSubmit={(ev) => void submit(ev)}
            className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
          >
            <FormField label="Date" error={e.date?.message}>
              {(c) => <Input {...c} type="date" {...form.register('date')} />}
            </FormField>
            <FormField label="Name" error={e.name?.message}>
              {(c) => (
                <Input {...c} placeholder="e.g. Independence Day" {...form.register('name')} />
              )}
            </FormField>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Add holiday
            </Button>
            {e.root?.message ? (
              <p role="alert" className="text-sm text-destructive sm:col-span-3">
                {e.root.message}
              </p>
            ) : null}
          </form>
          {settings.holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No holidays yet. HR adds the company’s holidays here.
            </p>
          ) : (
            <ul className="divide-y rounded-md border" aria-label="Holidays">
              {settings.holidays.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{formatDateKey(h.date)}</span> · {h.name}
                    {h.date < today ? <span className="text-muted-foreground"> (past)</span> : null}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${h.name}`}
                    onClick={() => setRemoving(h)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
      <SectionCard title="Working days">
        <ReadOnly>
          <p>Monday to Friday count as leave days (D-088) and get attendance reminders (D-093).</p>
          <p>Weekend and holiday rules for attendance itself are not decided yet (Q-ATT-05).</p>
        </ReadOnly>
      </SectionCard>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this holiday?"
        description={`${removing ? formatDateKey(removing.date) : ''} (${removing?.name ?? ''}) will count as a leave day again for new requests.`}
        confirmLabel="Remove"
        destructive
        isPending={remove.isPending}
        onConfirm={() => {
          if (removing)
            void remove
              .mutateAsync(removing.id)
              .then(() => toast.success('Holiday removed.'))
              .catch((error: unknown) => toast.error(userMessage(error)))
              .finally(() => setRemoving(null))
        }}
      />
    </div>
  )
}

function ApprovalsTab({ settings }: { settings: Settings }) {
  const save = useSettingsMutation((svc, input: Settings['approvals']) =>
    svc.updateApprovals(input),
  )
  const [rule, setRule] = useState<DecisionRule>(settings.approvals.decisionRule)
  const [reviewRequired, setReviewRequired] = useState(settings.approvals.reviewRequired)
  const ids = { rule: useId(), review: useId() }
  const changed =
    rule !== settings.approvals.decisionRule || reviewRequired !== settings.approvals.reviewRequired
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard
        title="Workflow options"
        description="Apply to new leave requests; requests already submitted keep their workflow."
        className="lg:col-span-2"
      >
        <div className="space-y-4">
          <div className="max-w-md space-y-1.5">
            <Label htmlFor={ids.rule}>When an employee selects several managers</Label>
            <NativeSelect
              id={ids.rule}
              value={rule}
              options={DECISION_RULES.map((r) => ({ value: r, label: DECISION_RULE_LABELS[r] }))}
              onChange={(e) => setRule(e.target.value as DecisionRule)}
            />
          </div>
          <div className="flex items-start gap-2">
            <input
              id={ids.review}
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={reviewRequired}
              onChange={(e) => setReviewRequired(e.target.checked)}
            />
            <div>
              <label htmlFor={ids.review} className="text-sm font-medium">
                Team Lead / Associate PM review must finish before the decision
              </label>
              <p className="text-xs text-muted-foreground">
                Off (default): reviewers can comment and recommend, the manager decides without
                waiting.
              </p>
            </div>
          </div>
          <Button
            disabled={!changed || save.isPending}
            onClick={() =>
              void save
                .mutateAsync({ decisionRule: rule, reviewRequired })
                .then(() => toast.success('Approval settings saved.'))
                .catch((error: unknown) => toast.error(userMessage(error)))
            }
          >
            {save.isPending ? 'Saving…' : 'Save approval settings'}
          </Button>
        </div>
      </SectionCard>
      <SectionCard title="Who decides">
        <ReadOnly>
          <ul className="list-disc space-y-1 pl-5">
            <li>Employee and Team Lead → their manager(s); no manager → HR.</li>
            <li>Manager and Senior PM → HR; Associate PM → Senior PM.</li>
            <li>HR Administrator → another HR Administrator.</li>
            <li>
              Nobody approves their own leave; declines need a reason; HR can decide any pending
              request with a reason.
            </li>
          </ul>
        </ReadOnly>
      </SectionCard>
    </div>
  )
}
