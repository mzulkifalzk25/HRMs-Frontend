import { Bell, FolderKanban } from 'lucide-react'
import { EmptyState } from '@/components/feedback/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatAppDateTime } from '@/lib/datetime'
import { LEAVE_TYPE_LABELS } from '@/types/hr'
import type {
  DepartmentStat,
  LeaveBalance,
  NotificationPreview,
  ProjectTeam,
} from '../schemas/dashboard.schema'

export function DepartmentOverview({ departments }: { departments: DepartmentStat[] }) {
  if (departments.length === 0) {
    return (
      <EmptyState
        title="No departments yet"
        description="Departments appear here once HR creates them."
        className="py-8"
      />
    )
  }
  return (
    <ul className="space-y-3">
      {departments.map((department) => {
        const percent =
          department.headcount === 0
            ? 0
            : Math.round((department.presentToday / department.headcount) * 100)
        return (
          <li key={department.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{department.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {department.presentToday} of {department.headcount} present
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${department.name} attendance today`}
              aria-valuemin={0}
              aria-valuemax={department.headcount}
              aria-valuenow={department.presentToday}
              aria-valuetext={`${department.presentToday} of ${department.headcount} present`}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function LeaveBalances({ balances }: { balances: LeaveBalance[] }) {
  if (balances.length === 0) {
    return (
      <EmptyState
        title="No leave allocation yet"
        description="HR has not allocated leave for this year."
        className="py-8"
      />
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {balances.map((balance) => (
        <li key={balance.leaveType} className="rounded-md border p-3">
          <p className="text-sm font-medium">{LEAVE_TYPE_LABELS[balance.leaveType]}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {balance.remaining}
            <span className="text-sm font-normal text-muted-foreground">
              {' '}
              / {balance.allocated} days left
            </span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">{balance.used} used</p>
        </li>
      ))}
    </ul>
  )
}

export function NotificationPreviewList({
  notifications,
}: {
  notifications: NotificationPreview[]
}) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications"
        description="You are all caught up."
        className="py-8"
      />
    )
  }
  return (
    <ul className="divide-y">
      {notifications.map((notification) => (
        <li key={notification.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <span
            aria-hidden="true"
            className={
              notification.read
                ? 'mt-1.5 size-2 shrink-0 rounded-full bg-muted'
                : 'mt-1.5 size-2 shrink-0 rounded-full bg-primary'
            }
          />
          <div className="min-w-0">
            <p className="text-sm">
              {notification.title}
              {notification.read ? null : <span className="sr-only"> (unread)</span>}
            </p>
            <p className="text-xs text-muted-foreground">{formatAppDateTime(notification.at)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ProjectTeamList({ teams }: { teams: ProjectTeam[] }) {
  if (teams.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project teams"
        description="Projects you oversee appear here."
        className="py-8"
      />
    )
  }
  return (
    <ul className="divide-y">
      {teams.map((team) => (
        <li
          key={team.id}
          className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{team.projectName}</p>
            <p className="text-xs text-muted-foreground">
              Associate PM: {team.associatePmName ?? 'Not assigned'} · {team.presentToday} of{' '}
              {team.teamSize} present
            </p>
          </div>
          {team.pendingApprovals > 0 ? (
            <StatusBadge tone="warning">
              {team.pendingApprovals} pending{' '}
              {team.pendingApprovals === 1 ? 'approval' : 'approvals'}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">No pending approvals</StatusBadge>
          )}
        </li>
      ))}
    </ul>
  )
}
