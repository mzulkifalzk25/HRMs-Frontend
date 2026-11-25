// Forgot password (P2-T05). The confirmation is identical whether or not the account exists.
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { userMessage } from '@/services/api'
import { services, type MockFixtures } from '@/services/registry'
import { useRequestPasswordReset } from '../api/use-auth-flows'
import { AuthCard } from '../components/auth-card'
import { MockHint } from '../components/mock-hint'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas/auth.schema'

export function ForgotPasswordPage({
  mockFixtures = services.mockFixtures,
}: {
  mockFixtures?: MockFixtures | null
}) {
  const request = useRequestPasswordReset()
  const form = useForm<ForgotPasswordFormValues, unknown, { email: string }>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  if (request.isSuccess) {
    return (
      <div className="space-y-4">
        <AuthCard
          title="Check your email"
          footer={
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          }
        >
          <p role="status" className="flex items-start gap-3 text-sm">
            <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            If an account exists for that email address, we have sent a link to reset the password.
            The link is valid for a limited time.
          </p>
        </AuthCard>
        {mockFixtures ? (
          <MockHint title="Mock mode: no email is sent">
            <p>Open the reset page directly:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <Link className="font-medium underline" to={mockFixtures.resetLinks.valid}>
                  Valid reset link
                </Link>{' '}
                (for the Employee demo account)
              </li>
              <li>
                <Link className="font-medium underline" to={mockFixtures.resetLinks.expired}>
                  Expired reset link
                </Link>
              </li>
            </ul>
          </MockHint>
        ) : null}
      </div>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your work email address and we will send you a link to choose a new password."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => request.mutate(values.email))}
      >
        <FormField label="Email" error={form.formState.errors.email?.message}>
          {(control) => (
            <Input {...control} type="email" autoComplete="username" {...form.register('email')} />
          )}
        </FormField>
        {request.isError ? (
          <p
            role="alert"
            className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground"
          >
            {userMessage(request.error)}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={request.isPending}>
          {request.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  )
}
