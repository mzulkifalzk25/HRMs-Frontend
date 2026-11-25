// Create/edit dialogs for departments, designations, teams and projects (P3-T08…T11).
import { zodResolver } from '@hookform/resolvers/zod'
import type { ReactNode } from 'react'
import { Controller, useForm, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { CheckboxList } from '@/components/forms/checkbox-list'
import { FormField } from '@/components/forms/form-field'
import { NativeSelect } from '@/components/forms/native-select'
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
import { useSaveOrgRecord } from '../api/use-organization'
import {
  departmentInputSchema,
  designationInputSchema,
  projectInputSchema,
  teamInputSchema,
  type Department,
  type DepartmentFormValues,
  type DepartmentInput,
  type Designation,
  type DesignationFormValues,
  type DesignationInput,
  type Project,
  type ProjectFormValues,
  type ProjectInput,
  type ReportingLine,
  type Team,
  type TeamFormValues,
  type TeamInput,
} from '../schemas/organization.schema'

type DialogProps<T> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Record being edited; null creates a new one. */
  record: T | null
}

function FormDialog<TValues extends FieldValues, TOutput>({
  open,
  onOpenChange,
  title,
  description,
  form,
  fields,
  onSave,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  form: UseFormReturn<TValues, unknown, TOutput>
  fields: readonly string[]
  onSave: (values: TOutput) => Promise<void>
  children: ReactNode
}) {
  const submit = form.handleSubmit(async (values) => {
    try {
      await onSave(values)
      onOpenChange(false)
    } catch (error) {
      form.setError('root', { message: applyServerErrors(error, form.setError, fields) })
    }
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-4" onSubmit={submit}>
          {children}
          {form.formState.errors.root?.message ? (
            <p
              role="alert"
              className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground"
            >
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const personOptions = (people: ReportingLine[], filter: (p: ReportingLine) => boolean) =>
  people
    .filter((p) => p.status !== 'inactive' && filter(p))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: p.name, description: p.designation ?? undefined }))

export function DepartmentDialog({ open, onOpenChange, record }: DialogProps<Department>) {
  const save = useSaveOrgRecord()
  const form = useForm<DepartmentFormValues, unknown, DepartmentInput>({
    resolver: zodResolver(departmentInputSchema),
    values: { name: record?.name ?? '', code: record?.code ?? '' },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? `Edit ${record.name}` : 'Add department'}
      description="Departments group employees for reporting and leave approval."
      form={form}
      fields={['name', 'code']}
      onSave={async (input) => {
        await save.mutateAsync({ entity: 'department', id: record?.id ?? null, input })
        toast.success(record ? 'Department updated.' : 'Department added.')
      }}
    >
      <FormField label="Name" error={form.formState.errors.name?.message}>
        {(c) => <Input {...c} {...form.register('name')} />}
      </FormField>
      <FormField
        label="Code (optional)"
        error={form.formState.errors.code?.message}
        hint="Short label, e.g. ENG."
      >
        {(c) => <Input {...c} {...form.register('code')} />}
      </FormField>
    </FormDialog>
  )
}

export function DesignationDialog({ open, onOpenChange, record }: DialogProps<Designation>) {
  const save = useSaveOrgRecord()
  const form = useForm<DesignationFormValues, unknown, DesignationInput>({
    resolver: zodResolver(designationInputSchema),
    values: { title: record?.title ?? '' },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? `Edit ${record.title}` : 'Add designation'}
      description="Job titles shown on employee profiles."
      form={form}
      fields={['title']}
      onSave={async (input) => {
        await save.mutateAsync({ entity: 'designation', id: record?.id ?? null, input })
        toast.success(record ? 'Designation updated.' : 'Designation added.')
      }}
    >
      <FormField label="Title" error={form.formState.errors.title?.message}>
        {(c) => <Input {...c} {...form.register('title')} />}
      </FormField>
    </FormDialog>
  )
}

export function TeamDialog({
  open,
  onOpenChange,
  record,
  departments,
  people,
}: DialogProps<Team> & { departments: Department[]; people: ReportingLine[] }) {
  const save = useSaveOrgRecord()
  const form = useForm<TeamFormValues, unknown, TeamInput>({
    resolver: zodResolver(teamInputSchema),
    values: {
      name: record?.name ?? '',
      departmentId: record?.departmentId ?? '',
      teamLeadId: record?.teamLeadId ?? null,
      memberIds: record?.memberIds ?? [],
    },
  })
  const errors = form.formState.errors
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? `Edit ${record.name}` : 'Add team'}
      description="Team leads review and comment on their team's leave requests."
      form={form}
      fields={['name', 'departmentId', 'teamLeadId', 'memberIds']}
      onSave={async (input) => {
        await save.mutateAsync({ entity: 'team', id: record?.id ?? null, input })
        toast.success(record ? 'Team updated.' : 'Team added.')
      }}
    >
      <FormField label="Name" error={errors.name?.message}>
        {(c) => <Input {...c} {...form.register('name')} />}
      </FormField>
      <FormField label="Department" error={errors.departmentId?.message}>
        {(c) => (
          <NativeSelect
            {...c}
            placeholder="Choose a department"
            options={departments
              .filter((d) => d.status === 'active' || d.id === record?.departmentId)
              .map((d) => ({ value: d.id, label: d.name }))}
            {...form.register('departmentId')}
          />
        )}
      </FormField>
      <Controller
        control={form.control}
        name="teamLeadId"
        render={({ field }) => (
          <FormField label="Team lead (optional)" error={errors.teamLeadId?.message}>
            {(c) => (
              <NativeSelect
                {...c}
                placeholder="No team lead"
                value={field.value ?? ''}
                onChange={(event) => field.onChange(event.target.value || null)}
                options={personOptions(people, () => true).map(({ value, label }) => ({
                  value,
                  label,
                }))}
              />
            )}
          </FormField>
        )}
      />
      <Controller
        control={form.control}
        name="memberIds"
        render={({ field }) => (
          <CheckboxList
            legend="Members"
            options={personOptions(people, () => true)}
            value={field.value}
            onChange={field.onChange}
            error={errors.memberIds?.message}
          />
        )}
      />
    </FormDialog>
  )
}

export function ProjectDialog({
  open,
  onOpenChange,
  record,
  teams,
  people,
}: DialogProps<Project> & { teams: Team[]; people: ReportingLine[] }) {
  const save = useSaveOrgRecord()
  const form = useForm<ProjectFormValues, unknown, ProjectInput>({
    resolver: zodResolver(projectInputSchema),
    values: {
      name: record?.name ?? '',
      code: record?.code ?? '',
      seniorPmId: record?.seniorPmId ?? null,
      associatePmId: record?.associatePmId ?? null,
      teamIds: record?.teamIds ?? [],
    },
  })
  const errors = form.formState.errors
  const personSelect = (
    name: 'seniorPmId' | 'associatePmId',
    label: string,
    role: ReportingLine['role'],
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormField label={label} error={errors[name]?.message}>
          {(c) => (
            <NativeSelect
              {...c}
              placeholder="Not assigned"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value || null)}
              options={personOptions(people, (p) => p.role === role).map(
                ({ value, label: text }) => ({ value, label: text }),
              )}
            />
          )}
        </FormField>
      )}
    />
  )
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? `Edit ${record.name}` : 'Add project'}
      description="Projects link teams to their Senior and Associate Project Managers."
      form={form}
      fields={['name', 'code', 'seniorPmId', 'associatePmId', 'teamIds']}
      onSave={async (input) => {
        await save.mutateAsync({ entity: 'project', id: record?.id ?? null, input })
        toast.success(record ? 'Project updated.' : 'Project added.')
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Name" error={errors.name?.message} className="sm:col-span-2">
          {(c) => <Input {...c} {...form.register('name')} />}
        </FormField>
        <FormField label="Code" error={errors.code?.message}>
          {(c) => <Input {...c} {...form.register('code')} />}
        </FormField>
      </div>
      {personSelect('seniorPmId', 'Senior Project Manager', 'senior_pm')}
      {personSelect('associatePmId', 'Associate Project Manager', 'associate_pm')}
      <Controller
        control={form.control}
        name="teamIds"
        render={({ field }) => (
          <CheckboxList
            legend="Teams"
            options={teams
              .filter((t) => t.status === 'active' || field.value.includes(t.id))
              .map((t) => ({ value: t.id, label: t.name }))}
            value={field.value}
            onChange={field.onChange}
            error={errors.teamIds?.message}
            emptyText="No active teams."
          />
        )}
      />
    </FormDialog>
  )
}
