// Who is involved in a request (P5-T01, P5-T16; D-064): decision-makers, optional reviewers and
// HR, who is always notified and cannot be removed.
import { Lock } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { PARTICIPANT_LABELS } from '../lib/leave-labels'
import { PARTICIPANT_KINDS, type Participant } from '../schemas/leave.schema'

const HEADINGS = {
  decision_maker: 'Decides (any one of them)',
  reviewer: 'Can review and recommend (optional)',
  recipient: 'Always notified',
} as const

export function ParticipantsPanel({ participants }: { participants: Participant[] }) {
  return (
    <div className="space-y-4">
      {PARTICIPANT_KINDS.map((kind) => {
        const people = participants.filter((p) => p.kind === kind)
        if (people.length === 0) return null
        return (
          <div key={kind} className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">{HEADINGS[kind]}</h3>
            <ul className="flex flex-wrap gap-1.5" aria-label={PARTICIPANT_LABELS[kind]}>
              {people.map((p) => (
                <li key={p.employeeId}>
                  <StatusBadge tone={kind === 'decision_maker' ? 'primary' : 'neutral'}>
                    {p.mandatory ? <Lock aria-hidden="true" className="size-3" /> : null}
                    {p.name}
                    {p.mandatory ? <span className="sr-only"> (HR, cannot be removed)</span> : null}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {participants.some((p) => p.mandatory) ? (
        <p className="text-xs text-muted-foreground">
          HR is notified about every leave request and cannot be removed.
        </p>
      ) : null}
    </div>
  )
}
