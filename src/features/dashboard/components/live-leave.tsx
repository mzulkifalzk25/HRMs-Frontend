// Leave widgets backed by the leave service (P5-T17), replacing the Phase 2 placeholder lists:
// the approval inbox, recent requests (own or in scope) and own balances.
import type { UseQueryResult } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import {
  useApprovalInbox,
  useLeaveBalances,
  useLeaveList,
  useMyLeaveRequests,
} from '@/features/leave'
import { appDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { ApprovalTaskList, LeaveRequestList } from './dashboard-lists'
import { LeaveBalances } from './dashboard-widgets'

const RECENT = 5
const requestLink = (id: string) => `/leave/requests/${id}`

function Live<T>({
  query,
  label,
  children,
}: {
  query: UseQueryResult<T>
  label: string
  children: (data: T) => ReactNode
}) {
  if (query.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading {label}…</span>
        <CardSkeleton lines={2} />
      </div>
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        title={`Could not load ${label}`}
        message={userMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    )
  }
  return <>{children(query.data)}</>
}

/** Requests waiting for the signed-in user's decision or recommendation. */
export function LiveApprovalTasks({ emptyText }: { emptyText: string }) {
  const inbox = useApprovalInbox('pending')
  return (
    <Live query={inbox} label="approvals">
      {(tasks) => (
        <ApprovalTaskList
          tasks={tasks.slice(0, RECENT)}
          emptyText={emptyText}
          linkTo={requestLink}
        />
      )}
    </Live>
  )
}

/** Recent requests in the caller's scope (newest start first). */
export function LiveTeamLeave({ emptyText }: { emptyText: string }) {
  const list = useLeaveList({ page: 1, pageSize: RECENT })
  return (
    <Live query={list} label="team leave">
      {(page) => (
        <LeaveRequestList requests={page.results} emptyText={emptyText} linkTo={requestLink} />
      )}
    </Live>
  )
}

export function LiveMyLeave() {
  const mine = useMyLeaveRequests()
  return (
    <Live query={mine} label="your leave requests">
      {(requests) => (
        <LeaveRequestList
          requests={requests.slice(0, RECENT)}
          showEmployee={false}
          emptyText="You have not requested leave recently."
          linkTo={requestLink}
        />
      )}
    </Live>
  )
}

export function LiveLeaveBalances() {
  const [year] = useState(() => Number(appDateKey(new Date()).slice(0, 4)))
  const balances = useLeaveBalances(null, year)
  return (
    <Live query={balances} label="leave balances">
      {(data) => <LeaveBalances balances={data} />}
    </Live>
  )
}
