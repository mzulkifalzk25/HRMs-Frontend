// Notification history (P6-T04): every notification you received, filtered by type, read state
// and date (Pakistan dates), paginated. Opening one marks it read.
import { CheckCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { PaginationBar } from '@/components/tables/pagination-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { userMessage } from '@/services/api'
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../api/use-notifications'
import { NotificationContent } from '../components/notification-item'
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from '../lib/notification-types'
import type { Notification, NotificationListQuery } from '../schemas/notification.schema'

const PAGE_SIZES = [10, 25, 50] as const

export function NotificationsPage() {
  const [query, setQuery] = useState<NotificationListQuery>({ page: 1, pageSize: 25 })
  const list = useNotifications(query)
  const unread = useUnreadCount()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const navigate = useNavigate()
  const ids = { type: useId(), status: useId(), from: useId(), to: useId() }
  const update = (changes: Partial<NotificationListQuery>) =>
    setQuery((q) => ({ ...q, page: 1, ...changes }))

  function open(n: Notification) {
    if (!n.read) markRead.mutate(n.id)
    if (n.link) void navigate(n.link)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Leave updates, requests waiting for you, attendance reminders and announcements."
        actions={
          <Button
            variant="outline"
            disabled={!unread.data || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck aria-hidden="true" />
            Mark all as read
          </Button>
        }
      />
      <section
        aria-label="Filters"
        className="grid gap-3 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor={ids.type}>Type</Label>
          <NativeSelect
            id={ids.type}
            placeholder="All types"
            value={query.type ?? ''}
            options={NOTIFICATION_TYPES.map((t) => ({
              value: t,
              label: NOTIFICATION_TYPE_LABELS[t],
            }))}
            onChange={(e) =>
              update({ type: (e.target.value || undefined) as NotificationListQuery['type'] })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.status}>Show</Label>
          <NativeSelect
            id={ids.status}
            placeholder="Read and unread"
            value={query.status ?? ''}
            options={[
              { value: 'unread', label: 'Unread only' },
              { value: 'read', label: 'Read only' },
            ]}
            onChange={(e) =>
              update({ status: (e.target.value || undefined) as NotificationListQuery['status'] })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.from}>From</Label>
          <Input
            id={ids.from}
            type="date"
            value={query.from ?? ''}
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.to}>To</Label>
          <Input
            id={ids.to}
            type="date"
            value={query.to ?? ''}
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>
      </section>
      <section
        aria-label="Notification list"
        aria-busy={list.isFetching}
        className="rounded-lg border bg-card shadow-xs"
      >
        {list.isPending ? (
          <>
            <span className="sr-only">Loading notifications…</span>
            <ListSkeleton rows={6} className="border-0" />
          </>
        ) : list.isError ? (
          <div className="p-4">
            <ErrorState
              title="Could not load notifications"
              message={userMessage(list.error)}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : list.data.results.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No notifications"
              description="Nothing matches these filters. You are all caught up."
            />
          </div>
        ) : (
          <>
            <ul className="divide-y" aria-label="Notifications">
              {list.data.results.map((n) => (
                <li key={n.id} className="flex items-start gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <NotificationContent notification={n} />
                  </button>
                  {n.read ? null : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead.mutate(n.id)}
                      aria-label={`Mark "${n.title}" as read`}
                    >
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <PaginationBar
              page={query.page}
              pageSize={query.pageSize}
              total={list.data.count}
              pageSizes={PAGE_SIZES}
              itemLabel="notifications"
              onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </>
        )}
      </section>
    </div>
  )
}
