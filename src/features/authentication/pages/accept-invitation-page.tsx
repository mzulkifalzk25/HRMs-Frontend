// Accept an HR invitation and set the first password (P2-T06, D-043).
// Expiry and resend rules are open (Q-AUTH-02); the UI handles every token state.
import { CircleCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { Button } from '@/components/ui/button'
import { userMessage } from '@/services/api'
import { useAcceptInvitation, useInvitationCheck } from '../api/use-auth-flows'
import { AuthCard } from '../components/auth-card'
import { SetPasswordForm } from '../components/set-password-form'
import { TokenProblem } from '../components/token-problem'

const askHr = <p>Ask your HR administrator to send you a new invitation.</p>

export function AcceptInvitationPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const check = useInvitationCheck(token)
  const accept = useAcceptInvitation()

  if (!token) {
    return (
      <AuthCard title="Activate your account">
        <TokenProblem status="missing" nextStep={askHr} />
      </AuthCard>
    )
  }

  if (accept.isSuccess) {
    return (
      <AuthCard title="Your account is ready">
        <p role="status" className="mb-4 flex items-start gap-3 text-sm">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          Your password is set. Sign in to start using FormbaxHR.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Activate your account"
      description="Your HR team invited you to FormbaxHR. Choose a password to finish."
    >
      {check.isPending ? (
        <div aria-busy="true">
          <CardSkeleton lines={2} />
          <span className="sr-only">Checking your invitation…</span>
        </div>
      ) : check.isError ? (
        <ErrorState
          title="Could not check this invitation"
          message={userMessage(check.error)}
          onRetry={() => void check.refetch()}
        />
      ) : check.data.status !== 'valid' ? (
        <TokenProblem status={check.data.status} nextStep={askHr} />
      ) : (
        <div className="space-y-4">
          {check.data.email ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              Account: <span className="font-medium">{check.data.email}</span>
            </p>
          ) : null}
          <SetPasswordForm
            submitLabel="Activate account"
            isPending={accept.isPending}
            serverError={accept.isError ? userMessage(accept.error) : undefined}
            onSubmit={(password) => accept.mutate({ token, password })}
          />
        </div>
      )}
    </AuthCard>
  )
}
