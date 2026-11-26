// Announcements (P6-T08, D-093): what HR has announced to you (everyone, your department or your
// team), newest first, until it expires or is archived. HR sees every active announcement and can
// include archived and expired ones.
import { Megaphone } from 'lucide-react'
import { useId, useState } from 'react'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { useCurrentUser } from '@/features/authentication'
import { appDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { useAnnouncements } from '../api/use-notifications'
import { AnnouncementCard } from '../components/announcement-card'

export function AnnouncementsPage() {
  const user = useCurrentUser()
  const isHr = user.role === 'hr_admin'
  const [includeInactive, setIncludeInactive] = useState(false)
  const [today] = useState(() => appDateKey(new Date()))
  const announcements = useAnnouncements(isHr && includeInactive)
  const toggleId = useId()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description={
          isHr
            ? 'Messages to everyone, departments or teams. They stay until they expire or you archive them.'
            : 'Messages from HR for you, your department or your team.'
        }
        actions={
          isHr ? (
            <div className="flex items-center gap-2 text-sm">
              <input
                id={toggleId}
                type="checkbox"
                className="size-4 accent-primary"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              <label htmlFor={toggleId}>Show archived and expired</label>
            </div>
          ) : null
        }
      />
      {announcements.isPending ? (
        <div aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading announcements…</span>
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : announcements.isError ? (
        <ErrorState
          title="Could not load announcements"
          message={userMessage(announcements.error)}
          onRetry={() => void announcements.refetch()}
        />
      ) : announcements.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="When HR announces something for you, it appears here."
        />
      ) : (
        <div className="space-y-4">
          {announcements.data.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} today={today} />
          ))}
        </div>
      )}
    </div>
  )
}
