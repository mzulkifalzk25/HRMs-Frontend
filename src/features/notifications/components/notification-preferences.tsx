// Notification preferences (D-093): reminders and announcements can be muted; leave lifecycle and
// approval notifications are always on (HR always receives leave notifications, D-064).
import { Lock } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { Button } from '@/components/ui/button'
import { userMessage } from '@/services/api'
import { useNotificationPreferences, useUpdatePreferences } from '../api/use-notifications'
import {
  MUTABLE_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  isMutable,
  type MutableNotificationType,
} from '../lib/notification-types'

const DESCRIPTIONS: Record<MutableNotificationType, string> = {
  attendance_reminder:
    'At 9:15 AM if you have not checked in, and the next morning if you forgot to check out.',
  announcement:
    'Messages from HR for everyone, your department or your team. They stay on the Announcements page either way.',
}

export function NotificationPreferences() {
  const preferences = useNotificationPreferences()
  if (preferences.isPending) return <CardSkeleton lines={3} />
  if (preferences.isError) {
    return (
      <ErrorState
        title="Could not load your preferences"
        message={userMessage(preferences.error)}
        onRetry={() => void preferences.refetch()}
      />
    )
  }
  return <PreferencesForm key={preferences.data.muted.join(',')} muted={preferences.data.muted} />
}

function PreferencesForm({ muted }: { muted: MutableNotificationType[] }) {
  const update = useUpdatePreferences()
  const idPrefix = useId()
  const [receive, setReceive] = useState<Set<MutableNotificationType>>(
    () => new Set(MUTABLE_NOTIFICATION_TYPES.filter((t) => !muted.includes(t))),
  )
  const changed = MUTABLE_NOTIFICATION_TYPES.some((t) => receive.has(t) === muted.includes(t))

  async function save() {
    try {
      await update.mutateAsync({ muted: MUTABLE_NOTIFICATION_TYPES.filter((t) => !receive.has(t)) })
      toast.success('Notification preferences saved.')
    } catch (error) {
      toast.error(userMessage(error))
    }
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">You can turn these off</legend>
        {MUTABLE_NOTIFICATION_TYPES.map((type) => {
          const id = `${idPrefix}-${type}`
          return (
            <div key={type} className="flex items-start gap-3">
              <input
                id={id}
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                aria-describedby={`${id}-hint`}
                checked={receive.has(type)}
                onChange={(e) => {
                  const next = new Set(receive)
                  if (e.target.checked) next.add(type)
                  else next.delete(type)
                  setReceive(next)
                }}
              />
              <div>
                <label htmlFor={id} className="block text-sm">
                  Receive {NOTIFICATION_TYPE_LABELS[type].toLowerCase()}s
                </label>
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                  {DESCRIPTIONS[type]}
                </p>
              </div>
            </div>
          )
        })}
      </fieldset>
      <div>
        <p className="mb-1 text-sm font-medium">Always on</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Always on">
          {NOTIFICATION_TYPES.filter((t) => !isMutable(t)).map((t) => (
            <li
              key={t}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
            >
              <Lock aria-hidden="true" className="size-3" />
              {NOTIFICATION_TYPE_LABELS[t]}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave updates and requests waiting for you cannot be turned off.
        </p>
      </div>
      <Button onClick={() => void save()} disabled={!changed || update.isPending}>
        {update.isPending ? 'Saving…' : 'Save preferences'}
      </Button>
    </div>
  )
}
