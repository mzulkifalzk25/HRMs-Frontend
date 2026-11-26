// New HR announcement (P6-T08, D-093): title, message, audience (everyone, departments or teams)
// and an optional last day. People in the audience are notified unless they muted announcements.
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import { useDepartments, useTeams } from '@/features/organization'
import { appDateKey } from '@/lib/datetime'
import { useCreateAnnouncement } from '../api/use-notifications'
import {
  announcementFormSchema,
  type AnnouncementFormValues,
  type AnnouncementInput,
} from '../schemas/notification.schema'

export function AnnouncementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <AnnouncementForm onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AnnouncementForm({ onClose }: { onClose: () => void }) {
  const [today] = useState(() => appDateKey(new Date()))
  const create = useCreateAnnouncement()
  const departments = useDepartments()
  const teams = useTeams()
  const form = useForm<AnnouncementFormValues, unknown, AnnouncementInput>({
    resolver: zodResolver(announcementFormSchema(today)),
    defaultValues: {
      title: '',
      body: '',
      audienceKind: 'everyone',
      audienceIds: [],
      expiresOn: '',
    },
  })
  const errors = form.formState.errors
  const [kind, ids] = useWatch({ control: form.control, name: ['audienceKind', 'audienceIds'] })
  const units =
    kind === 'departments'
      ? (departments.data ?? []).filter((d) => d.status === 'active')
      : (teams.data ?? []).filter((t) => t.status === 'active')

  const submit = form.handleSubmit(async (input) => {
    try {
      await create.mutateAsync(input)
      toast.success('Announcement published. The audience has been notified.')
      onClose()
    } catch (error) {
      const message = applyServerErrors(error, form.setError, ['title', 'body', 'expiresOn'])
      const audience = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors?.audience
      if (audience?.[0]) form.setError('audienceIds', { message: audience[0] })
      form.setError('root', { message })
    }
  })

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
      <DialogHeader>
        <DialogTitle>New announcement</DialogTitle>
        <DialogDescription>
          Shown on the Announcements page and sent as a notification (in the app only).
        </DialogDescription>
      </DialogHeader>
      <FormField label="Title" error={errors.title?.message}>
        {(c) => <Input {...c} {...form.register('title')} />}
      </FormField>
      <FormField label="Message" error={errors.body?.message}>
        {(c) => <Textarea {...c} rows={4} {...form.register('body')} />}
      </FormField>
      <FormField label="Audience">
        {(c) => (
          <NativeSelect
            {...c}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'departments', label: 'Departments' },
              { value: 'teams', label: 'Teams' },
            ]}
            {...form.register('audienceKind', {
              onChange: () => form.setValue('audienceIds', []),
            })}
          />
        )}
      </FormField>
      {kind !== 'everyone' ? (
        <CheckboxList
          legend={kind === 'departments' ? 'Departments' : 'Teams'}
          options={units.map((u) => ({ value: u.id, label: u.name }))}
          value={ids}
          error={errors.audienceIds?.message}
          onChange={(next) => form.setValue('audienceIds', next, { shouldValidate: true })}
        />
      ) : null}
      <FormField
        label="Show until (optional)"
        error={errors.expiresOn?.message}
        hint="Leave empty to keep it until you archive it."
      >
        {(c) => <Input {...c} type="date" min={today} {...form.register('expiresOn')} />}
      </FormField>
      {errors.root?.message ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Publishing…' : 'Publish'}
        </Button>
      </DialogFooter>
    </form>
  )
}
