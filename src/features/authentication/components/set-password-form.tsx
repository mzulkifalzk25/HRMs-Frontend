// New-password form shared by "reset password" and "accept invitation" (P2-T05, P2-T06).
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { FormField } from '@/components/forms/form-field'
import { PasswordInput } from '@/components/forms/password-input'
import { Button } from '@/components/ui/button'
import { setPasswordSchema, type SetPasswordFormValues } from '../schemas/auth.schema'
import { PasswordRequirements } from './password-requirements'

type SetPasswordFormProps = {
  submitLabel: string
  isPending: boolean
  /** Server error to show above the button (user-safe text). */
  serverError?: string
  onSubmit: (password: string) => void
}

export function SetPasswordForm({
  submitLabel,
  isPending,
  serverError,
  onSubmit,
}: SetPasswordFormProps) {
  const form = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const password = useWatch({ control: form.control, name: 'password' })

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => onSubmit(values.password))}
    >
      <FormField
        label="New password"
        error={form.formState.errors.password?.message}
        hint={<PasswordRequirements password={password} />}
      >
        {(control) => (
          <PasswordInput {...control} autoComplete="new-password" {...form.register('password')} />
        )}
      </FormField>
      <FormField
        label="Confirm new password"
        error={form.formState.errors.confirmPassword?.message}
      >
        {(control) => (
          <PasswordInput
            {...control}
            autoComplete="new-password"
            {...form.register('confirmPassword')}
          />
        )}
      </FormField>
      {serverError ? (
        <p
          role="alert"
          className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground"
        >
          {serverError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
