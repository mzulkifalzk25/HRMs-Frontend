// Approval inbox (P5-T09): requests waiting for your decision or recommendation, and the ones you
// already acted on. Filter by leave type; sort by submission or start date.
import { useId, useState } from 'react'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { userMessage } from '@/services/api'
import { LEAVE_TYPE_LABELS, LEAVE_TYPES, type LeaveType } from '@/types/hr'
import { useApprovalInbox } from '../api/use-leave'
import { LeaveRequestList } from '../components/leave-request-list'
import type { ApprovalTask, InboxTab } from '../schemas/leave.schema'

type Sort = 'submitted' | 'start'

function InboxList({ tab, type, sort }: { tab: InboxTab; type: LeaveType | ''; sort: Sort }) {
  const inbox = useApprovalInbox(tab)
  if (inbox.isPending) return <ListSkeleton rows={4} className="border-0" />
  if (inbox.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title="Could not load approvals"
          message={userMessage(inbox.error)}
          onRetry={() => void inbox.refetch()}
        />
      </div>
    )
  }
  const key = (t: ApprovalTask) => (sort === 'start' ? t.startDate : t.submittedAt)
  const rows = inbox.data
    .filter((t) => !type || t.leaveType === type)
    .sort((a, b) => key(a).localeCompare(key(b)))
  if (rows.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title={tab === 'pending' ? 'Nothing waiting for you' : 'No decisions yet'}
          description={
            tab === 'pending'
              ? 'Leave requests that need your decision or recommendation appear here.'
              : 'Requests you approve, decline, recommend or comment on appear here.'
          }
        />
      </div>
    )
  }
  return (
    <LeaveRequestList
      requests={rows}
      caption={tab === 'pending' ? 'Waiting for you' : 'Your past decisions'}
    />
  )
}

export function ApprovalsPage() {
  const [type, setType] = useState<LeaveType | ''>('')
  const [sort, setSort] = useState<Sort>('submitted')
  const ids = { type: useId(), sort: useId() }
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={ids.type} className="text-xs">
        Type
      </Label>
      <NativeSelect
        id={ids.type}
        placeholder="All types"
        value={type}
        options={LEAVE_TYPES.map((t) => ({ value: t, label: LEAVE_TYPE_LABELS[t] }))}
        onChange={(e) => setType(e.target.value as LeaveType | '')}
      />
      <Label htmlFor={ids.sort} className="text-xs">
        Sort by
      </Label>
      <NativeSelect
        id={ids.sort}
        value={sort}
        options={[
          { value: 'submitted', label: 'Oldest submitted first' },
          { value: 'start', label: 'Earliest start first' },
        ]}
        onChange={(e) => setSort(e.target.value as Sort)}
      />
    </div>
  )
  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Leave requests you decide or review. Open a request to act on it."
      />
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Waiting for me</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        {(['pending', 'history'] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <SectionCard
              title={tab === 'pending' ? 'Waiting for me' : 'History'}
              contentClassName="p-0"
              actions={filters}
            >
              <InboxList tab={tab} type={type} sort={sort} />
            </SectionCard>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
