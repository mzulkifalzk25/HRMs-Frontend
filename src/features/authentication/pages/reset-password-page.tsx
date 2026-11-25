// Reset password from an emailed link (P2-T05): token from the URL; invalid/expired states.
import { CircleCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { userMessage } from '@/services/api'
import { useResetPassword, useResetTokenCheck } from '../api/use-auth-flows'
import { AuthCard } from '../components/auth-card'
import { SetPasswordForm } from '../components/set-password-form'
import { TokenProblem } from '../components/token-problem'

const requestNewLink = (
  <Link to="/forgot-password" className="font-medium text-primary hover:underline">
    Request a new reset link
  </Link>
)

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const check = useResetTokenCheck(token)
  const reset = useResetPassword()

  if (!token) {
    return (
      <AuthCard title="Reset your password">
        <TokenProblem status="missing" nextStep={requestNewLink} />
      </AuthCard>
    )
  }

  if (reset.isSuccess) {
    return (
      <AuthCard title="Password changed">
        <p role="status" className="mb-4 flex items-start gap-3 text-sm">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          Your password has been changed. Sign in with your new password.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Use a password you do not use anywhere else."
    >
      {check.isPending ? (
        <div aria-busy="true">
          <CardSkeleton lines={2} />
          <span className="sr-only">Checking your link…</span>
        </div>
      ) : check.isError ? (
        <ErrorState
          title="Could not check this link"
          message={userMessage(check.error)}
          onRetry={() => void check.refetch()}
        />
      ) : check.data.status !== 'valid' ? (
        <TokenProblem status={check.data.status} nextStep={requestNewLink} />
      ) : (
        <SetPasswordForm
          submitLabel="Change password"
          isPending={reset.isPending}
          serverError={reset.isError ? userMessage(reset.error) : undefined}
          onSubmit={(password) => reset.mutate({ token, password })}
        />
      )}
    </AuthCard>
  )
}
