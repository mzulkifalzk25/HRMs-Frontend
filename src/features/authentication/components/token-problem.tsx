import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TokenCheck } from '../types'

const COPY: Record<Exclude<TokenCheck['status'], 'valid'>, { title: string; body: string }> = {
  invalid: {
    title: 'This link is not valid',
    body: 'The link is incomplete or was not issued by FormbaxHR.',
  },
  expired: { title: 'This link has expired', body: 'Links are only valid for a limited time.' },
  used: { title: 'This link was already used', body: 'Each link can be used only once.' },
}

/** Shown when an emailed reset/invitation link cannot be used. */
export function TokenProblem({
  status,
  nextStep,
}: {
  status: Exclude<TokenCheck['status'], 'valid'> | 'missing'
  nextStep: ReactNode
}) {
  const copy =
    status === 'missing'
      ? { title: 'This link is incomplete', body: 'Open the link from your email again.' }
      : COPY[status]
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-destructive/30 bg-destructive-subtle p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive-subtle-foreground">
        <CircleAlert aria-hidden="true" className="size-4" />
        {copy.title}
      </p>
      <p className="text-sm">{copy.body}</p>
      <div className="text-sm">{nextStep}</div>
    </div>
  )
}
