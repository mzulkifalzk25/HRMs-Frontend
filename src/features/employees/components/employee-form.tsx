// Create/edit employee form (P3-T05, P3-T06, P3-T12). Validates with Zod, previews reporting
// cycles before submitting (the backend checks again), and shows server field errors in place.
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { CheckboxList } from '@/components/forms/checkbox-list'
import { FormField } from '@/components/forms/form-field'
import { NativeSelect } from '@/components/forms/native-select'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROLE_LABELS, ROLES } from '@/features/authentication'
import {
  findReportingCycle,
  type Department,
  type Designation,
  type Project,
  type ReportingLine,
  type Team,
} from '@/features/organization'
import { ApiError, userMessage } from '@/services/api'
import { EMPLOYEE_POLICY } from '../lib/employee-policy'
import {
  employeeFormSchema,
  type EmployeeFormValues,
  type EmployeeInput,
} from '../schemas/employee.schema'

export type EmployeeFormLookups = {
  departments: Department[]
  designations: Designation[]
  teams: Team[]
  projects: Project[]
  people: ReportingLine[]
}

type EmployeeFormProps = {
  /** Present when editing. */
  employeeId?: string
  defaultValues: EmployeeFormValues
  lookups: EmployeeFormLookups
  /** HR editing their own record cannot change their own role (Q-ORG-05, provisional). */
  isOwnRecord?: boolean
  submitLabel: string
  onSubmit: (values: EmployeeInput) => Promise<unknown>
  onCancel: () => void
}

const FIELD_NAMES = Object.keys(employeeFormSchema.shape) as Array<keyof EmployeeFormValues>

export function EmployeeForm({
  employeeId,
  defaultValues,
  lookups,
  isOwnRecord = false,
  submitLabel,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const form = useForm<EmployeeFormValues, unknown, EmployeeInput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues,
  })
  const { errors, isSubmitting } = form.formState
  const managerIds = useWatch({ control: form.control, name: 'managerIds' })
  const roleLocked = isOwnRecord && !EMPLOYEE_POLICY.hrCanChangeOwnRoleOrStatus

  // Live reporting-loop preview (P3-T12). The server is still authoritative.
  const cycle = employeeId ? findReportingCycle(lookups.people, employeeId, managerIds) : null
  const nameOf = (id: string) => lookups.people.find((p) => p.id === id)?.name ?? id
  const cycleMessage = cycle
    ? `This would create a reporting loop: ${cycle.map(nameOf).join(' → ')}.`
    : undefined
  // Depends on the message string, not the `cycle` array (a new array every render would
  // re-run this effect forever), and only touches the error when it actually changes.
  useEffect(() => {
    const current = form.getFieldState('managerIds').error?.message
    if (cycleMessage && current !== cycleMessage)
      form.setError('managerIds', { message: cycleMessage })
    if (!cycleMessage && current?.startsWith('This would create a reporting loop'))
      form.clearErrors('managerIds')
  }, [cycleMessage, form])

  async function submit(values: EmployeeInput) {
    if (cycle) return
    try {
      await onSubmit(values)
    } catch (error) {
      let mapped = false
      if (error instanceof ApiError) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if ((FIELD_NAMES as string[]).includes(field)) {
            form.setError(field as keyof EmployeeFormValues, { message: messages[0] })
            mapped = true
          }
        }
      }
      form.setError('root', {
        message: mapped ? 'Please correct the highlighted fields.' : userMessage(error),
      })
    }
  }

  const activeOnly = <T extends { status: string }>(items: T[], keep: readonly string[] = []) =>
    items.filter(
      (item) => item.status === 'active' || keep.includes((item as unknown as { id: string }).id),
    )

  const managerOptions = lookups.people
    .filter(
      (person) =>
        person.id !== employeeId &&
        (person.status !== 'inactive' || managerIds.includes(person.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => ({
      value: person.id,
      label: person.name,
      description:
        [person.designation, person.departmentName].filter(Boolean).join(' · ') || undefined,
    }))

  return (
    <form noValidate className="space-y-6" onSubmit={form.handleSubmit(submit)}>
      <SectionCard title="Personal details" description="Only work-related details are stored.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" error={errors.firstName?.message}>
            {(c) => <Input {...c} autoComplete="off" {...form.register('firstName')} />}
          </FormField>
          <FormField label="Last name" error={errors.lastName?.message}>
            {(c) => <Input {...c} autoComplete="off" {...form.register('lastName')} />}
          </FormField>
          <FormField
            label="Work email"
            error={errors.email?.message}
            hint="The invitation to set a password is sent here."
          >
            {(c) => <Input {...c} type="email" autoComplete="off" {...form.register('email')} />}
          </FormField>
          <FormField label="Phone (optional)" error={errors.phone?.message}>
            {(c) => <Input {...c} type="tel" autoComplete="off" {...form.register('phone')} />}
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Job" description="The employee ID is assigned automatically.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Role"
            error={errors.role?.message}
            hint={
              roleLocked
                ? 'You cannot change your own role. Ask another HR administrator.'
                : 'Controls what the person can see and do.'
            }
          >
            {(c) =>
              roleLocked ? (
                // Not registered: a disabled field would submit as undefined. The value stays
                // in the form state from defaultValues and is sent unchanged.
                <Input {...c} readOnly value={ROLE_LABELS[defaultValues.role]} />
              ) : (
                <NativeSelect
                  {...c}
                  options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                  {...form.register('role')}
                />
              )
            }
          </FormField>
          <FormField label="Joining date" error={errors.joiningDate?.message}>
            {(c) => <Input {...c} type="date" {...form.register('joiningDate')} />}
          </FormField>
          <FormField label="Department" error={errors.departmentId?.message}>
            {(c) => (
              <NativeSelect
                {...c}
                placeholder="Choose a department"
                options={activeOnly(lookups.departments, [defaultValues.departmentId]).map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
                {...form.register('departmentId')}
              />
            )}
          </FormField>
          <FormField label="Designation" error={errors.designationId?.message}>
            {(c) => (
              <NativeSelect
                {...c}
                placeholder="Choose a designation"
                options={activeOnly(lookups.designations, [defaultValues.designationId]).map(
                  (d) => ({ value: d.id, label: d.title }),
                )}
                {...form.register('designationId')}
              />
            )}
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Reporting, teams and projects"
        description="Someone can report to several managers, or to nobody."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Controller
            control={form.control}
            name="managerIds"
            render={({ field }) => (
              <CheckboxList
                legend="Managers"
                hint="Leave empty if this person has no manager (their leave then goes to HR)."
                options={managerOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.managerIds?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="teamIds"
            render={({ field }) => (
              <CheckboxList
                legend="Teams"
                options={activeOnly(lookups.teams, field.value).map((t) => ({
                  value: t.id,
                  label: t.name,
                }))}
                value={field.value}
                onChange={field.onChange}
                error={errors.teamIds?.message}
                emptyText="No active teams."
              />
            )}
          />
          <Controller
            control={form.control}
            name="projectIds"
            render={({ field }) => (
              <CheckboxList
                legend="Projects"
                options={activeOnly(lookups.projects, field.value).map((p) => ({
                  value: p.id,
                  label: p.name,
                  description: p.code,
                }))}
                value={field.value}
                onChange={field.onChange}
                error={errors.projectIds?.message}
                emptyText="No active projects."
              />
            )}
          />
        </div>
      </SectionCard>

      {errors.root?.message ? (
        <p
          role="alert"
          className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground"
        >
          {errors.root.message}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || Boolean(cycle)}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
