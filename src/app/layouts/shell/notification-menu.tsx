// Notification center (P6-T03): bell with the unread count (polled, D-094), the latest
// notifications, "mark all as read" and a link to the full history. Radix provides keyboard
// navigation, focus handling and Escape to close.
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  NotificationContent,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
  type Notification,
} from '@/features/notifications'
import { userMessage } from '@/services/api'

const LATEST = 8

export function NotificationMenu() {
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount()
  const count = unread.data ?? 0
  const label = count > 0 ? `Notifications, ${count} unread` : 'Notifications'

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative">
          <Bell aria-hidden="true" />
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-white"
            >
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        {open ? <MenuBody unread={count} onNavigate={() => setOpen(false)} /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuBody({ unread, onNavigate }: { unread: number; onNavigate: () => void }) {
  const latest = useNotifications({ page: 1, pageSize: LATEST })
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const navigate = useNavigate()

  function open(n: Notification) {
    if (!n.read) markRead.mutate(n.id)
    onNavigate()
    if (n.link) void navigate(n.link)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 pr-1">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {unread > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        ) : null}
      </div>
      <DropdownMenuSeparator />
      {latest.isPending ? (
        <div aria-busy="true" className="space-y-2 p-2">
          <span className="sr-only">Loading notifications…</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : latest.isError ? (
        <p role="alert" className="px-2 py-4 text-sm text-destructive">
          {userMessage(latest.error)}
        </p>
      ) : latest.data.results.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
          You have no notifications.
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {latest.data.results.map((n) => (
            <DropdownMenuItem key={n.id} onSelect={() => open(n)} className="py-2">
              <NotificationContent notification={n} compact />
            </DropdownMenuItem>
          ))}
        </div>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to="/notifications" onClick={onNavigate} className="justify-center text-sm">
          View all notifications
        </Link>
      </DropdownMenuItem>
    </>
  )
}
