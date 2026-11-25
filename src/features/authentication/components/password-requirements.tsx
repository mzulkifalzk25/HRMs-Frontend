import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '../lib/password-policy'

/** Live checklist of the (provisional, Q-AUTH-01) password rules. */
export function PasswordRequirements({ password, id }: { password: string; id?: string }) {
  return (
    <ul id={id} className="space-y-1" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li
            key={rule.id}
            className={
              met
                ? 'flex items-center gap-2 text-success-subtle-foreground'
                : 'flex items-center gap-2'
            }
          >
            {met ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Circle aria-hidden="true" className="size-3.5" />
            )}
            <span>
              {rule.label}
              <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        )
      })}
      <li className="text-muted-foreground">
        Common or easily guessed passwords are rejected by the server.
      </li>
    </ul>
  )
}
