// Announcements (P6-T08, D-093): what HR has announced to you (everyone, your department or your
// team), newest first, until it expires or is archived. HR sees every active announcement and can
// include archived and expired ones.
import { Archive, Megaphone, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useId, useState } from 'react'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/authentication'
import { appDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { useAnnouncements, useArchiveAnnouncement } from '../api/use-notifications'
import { AnnouncementDialog } from '../components/announcement-dialog'
import { AnnouncementCard } from '../components/announcement-card'
import type { Announcement } from '../schemas/notification.schema'

export function AnnouncementsPage() {
  const user = useCurrentUser()
  const isHr = user.role === 'hr_admin'
  const [includeInactive, setIncludeInactive] = useState(false)
  const [today] = useState(() => appDateKey(new Date()))
  const announcements = useAnnouncements(isHr && includeInactive)
  const toggleId = useId()
  const [creating, setCreating] = useState(false)
  const [archiving, setArchiving] = useState<Announcement | null>(null)
  const archive = useArchiveAnnouncement()

  async function confirmArchive() {
    if (!archiving) return
    try {
      await archive.mutateAsync(archiving.id)
      toast.success('Announcement archived. It is no longer shown.')
    } catch (error) {
      toast.error(userMessage(error))
    } finally {
      setArchiving(null)
    }
  }

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
              <Button className="ml-2" onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" />
                New announcement
              </Button>
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
            <AnnouncementCard
              key={a.id}
              announcement={a}
              today={today}
              actions={
                isHr && !a.archived ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setArchiving(a)}
                    aria-label={`Archive "${a.title}"`}
                  >
                    <Archive aria-hidden="true" />
                    Archive
                  </Button>
                ) : null
              }
            />
          ))}
        </div>
      )}
      {isHr ? <AnnouncementDialog open={creating} onOpenChange={setCreating} /> : null}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(next) => !next && setArchiving(null)}
        title="Archive this announcement?"
        description={`“${archiving?.title ?? ''}” will no longer be shown. It stays in the archive.`}
        confirmLabel="Archive"
        destructive
        isPending={archive.isPending}
        onConfirm={() => void confirmArchive()}
      />
    </div>
  )
}
