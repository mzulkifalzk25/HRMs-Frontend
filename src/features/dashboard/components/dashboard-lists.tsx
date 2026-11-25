// List components shared by the role dashboards. Lists (not wide tables) stay usable on mobile.
import { ClipboardCheck, History, Users } from 'lucide-react'
import { EmptyState } from '@/components/feedback/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import { formatAppDateTime, formatAppTime } from '@/lib/datetime'
import { dateRange } from '../lib/format'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, TODAY_STATUS_LABELS } from '@/types/hr'
import {
  APPROVAL_STAGE_LABELS,
  APPROVAL_STAGE_TONE,
  LEAVE_STATUS_TONE,
  TODAY_STATUS_TONE,
} from '../lib/status-tones'
import type {
  ActivityItem,
  ApprovalTask,
  LeaveRequestSummary,
  TeamMember,
} from '../schemas/dashboard.schema'

function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function days(value: number): string {
  return `${value} ${value === 1 ? 'day' : 'days'}`
}

export function TeamMemberList({ members }: { members: TeamMember[] }) {
  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No team members"
        description="Nobody reports to you yet."
        className="py-8"
      />
    )
  }
  return (
    <ul className="divide-y">
      {members.map((member) => (
        <li key={member.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <UserAvatar initials={nameInitials(member.name)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{member.name}</p>
            <p className="truncate text-xs text-muted-foreground">{member.designation}</p>
          </div>
          <StatusBadge tone={TODAY_STATUS_TONE[member.todayStatus]}>
            {TODAY_STATUS_LABELS[member.todayStatus]}
          </StatusBadge>
        </li>
      ))}
    </ul>
  )
}

export function ApprovalTaskList({
  tasks,
  emptyText,
}: {
  tasks: ApprovalTask[]
  emptyText: string
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Nothing waiting for you"
        description={emptyText}
        className="py-8"
      />
    )
  }
  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {task.employeeName} · {LEAVE_TYPE_LABELS[task.leaveType]} leave
            </p>
            <p className="text-xs text-muted-foreground">
              {dateRange(task.startDate, task.endDate)} · {days(task.requestedDays)} · submitted{' '}
              {formatAppDateTime(task.submittedAt)}
            </p>
          </div>
          <StatusBadge tone={APPROVAL_STAGE_TONE[task.stage]}>
            {APPROVAL_STAGE_LABELS[task.stage]}
          </StatusBadge>
        </li>
      ))}
    </ul>
  )
}

export function LeaveRequestList({
  requests,
  showEmployee = true,
  emptyText,
}: {
  requests: LeaveRequestSummary[]
  showEmployee?: boolean
  emptyText: string
}) {
  if (requests.length === 0) {
    return <EmptyState title="No leave requests" description={emptyText} className="py-8" />
  }
  return (
    <ul className="divide-y">
      {requests.map((request) => (
        <li
          key={request.id}
          className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {showEmployee ? `${request.employeeName} · ` : ''}
              {LEAVE_TYPE_LABELS[request.leaveType]} leave
            </p>
            <p className="text-xs text-muted-foreground">
              {dateRange(request.startDate, request.endDate)} · {days(request.requestedDays)}
            </p>
          </div>
          <StatusBadge tone={LEAVE_STATUS_TONE[request.status]}>
            {LEAVE_STATUS_LABELS[request.status]}
          </StatusBadge>
        </li>
      ))}
    </ul>
  )
}

export function ActivityList({ items, emptyText }: { items: ActivityItem[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No recent activity"
        description={emptyText}
        className="py-8"
      />
    )
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 text-sm">
          <time
            dateTime={item.at}
            className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {formatAppTime(item.at)}
          </time>
          <p className="min-w-0">
            <span className="font-medium">{item.actor}</span> {item.action}{' '}
            <span className="font-medium">{item.target}</span>
          </p>
        </li>
      ))}
    </ol>
  )
}
