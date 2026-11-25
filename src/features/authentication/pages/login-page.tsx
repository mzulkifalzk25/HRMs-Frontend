// Login (P2-T04, P2-T08). No public signup (D-042). Errors never reveal whether an account exists.
import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FormField } from '@/components/forms/form-field'
import { PasswordInput } from '@/components/forms/password-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, userMessage } from '@/services/api'
import { services, type MockFixtures } from '@/services/registry'
import { AuthCard } from '../components/auth-card'
import { MockHint } from '../components/mock-hint'
import { postLoginPath } from '../lib/role-routes'
import { loginSchema, type LoginFormValues } from '../schemas/auth.schema'
import { useAuth } from '../session/auth-context'
import { ROLE_LABELS } from '../types'

type LoginOutput = { email: string; password: string }

export function LoginPage({
  mockFixtures = services.mockFixtures,
}: {
  mockFixtures?: MockFixtures | null
}) {
  const { login, state } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)
  const sessionExpired =
    params.get('reason') === 'expired' ||
    (state.status === 'unauthenticated' && state.reason === 'expired')

  const form = useForm<LoginFormValues, unknown, LoginOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: LoginOutput) {
    setFormError(null)
    try {
      const user = await login(values)
      await navigate(postLoginPath(user.role, params.get('redirect')), { replace: true })
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field === 'email' || field === 'password') {
            form.setError(field, { message: messages[0] })
          }
        }
      }
      setFormError(userMessage(error))
    }
  }

  return (
    <div className="space-y-4">
      <AuthCard
        title="Sign in to FormbaxHR"
        description="Use the work email address your HR team registered for you."
        footer="Accounts are created by HR. Contact your HR administrator if you need access."
      >
        {sessionExpired ? (
          <p className="mb-4 flex items-start gap-2 rounded-md bg-info-subtle px-3 py-2 text-sm text-info-subtle-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Your session expired. Please sign in again.
          </p>
        ) : null}
        <form noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField label="Email" error={errors.email?.message}>
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="username"
                {...form.register('email')}
              />
            )}
          </FormField>
          <FormField
            label="Password"
            error={errors.password?.message}
            labelAction={
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            }
          >
            {(control) => (
              <PasswordInput
                {...control}
                autoComplete="current-password"
                {...form.register('password')}
              />
            )}
          </FormField>
          {formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive-subtle-foreground"
            >
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </AuthCard>

      {mockFixtures ? (
        <MockHint title="Mock mode: demo accounts">
          <p>
            Every demo account uses the password{' '}
            <code className="font-mono font-semibold">{mockFixtures.demoPassword}</code>. These
            accounts are fictional and exist only in mock mode.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {mockFixtures.demoAccounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="w-full rounded-md border border-warning/50 bg-card px-2.5 py-1.5 text-left text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => {
                    form.setValue('email', account.email, { shouldValidate: true })
                    form.setValue('password', mockFixtures.demoPassword, { shouldValidate: true })
                  }}
                >
                  <span className="block font-medium">{ROLE_LABELS[account.role]}</span>
                  <span className="block text-muted-foreground">{account.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </MockHint>
      ) : null}
    </div>
  )
}
