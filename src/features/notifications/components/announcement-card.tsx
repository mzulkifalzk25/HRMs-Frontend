// One HR announcement (P6-T08): title, message, audience, author, dates. The element id lets
// notification links jump to it (#ann-…).
import type { ReactNode } from 'react'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatAppDateTime, formatDateKey } from '@/lib/datetime'
import type { Announcement } from '../schemas/notification.schema'

export function AnnouncementCard({
  announcement,
  today,
  actions,
}: {
  announcement: Announcement
  today: string
  actions?: ReactNode
}) {
  const expired = announcement.expiresOn !== null && announcement.expiresOn < today
  const headingId = `${announcement.id}-title`
  return (
    <article
      id={announcement.id}
      aria-labelledby={headingId}
      className="scroll-mt-20 space-y-2 rounded-lg border bg-card p-5 shadow-xs target:ring-2 target:ring-ring"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold">
          {announcement.title}
        </h2>
        <div className="flex flex-wrap gap-1">
          {announcement.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
          {expired ? <StatusBadge tone="neutral">Expired</StatusBadge> : null}
          <StatusBadge tone="info">{announcement.audienceLabel}</StatusBadge>
        </div>
      </div>
      <p className="text-sm whitespace-pre-line">{announcement.body}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {announcement.authorName} · {formatAppDateTime(announcement.createdAt)}
          {announcement.expiresOn
            ? ` · shown until ${formatDateKey(announcement.expiresOn)}`
            : ' · shown until archived'}
        </p>
        {actions}
      </div>
    </article>
  )
}
