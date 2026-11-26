// My leave (P5-T05, P5-T03, P5-T14): balances per category, own requests and the ledger.
// Every role has this page and sees only their own data here (D-044).
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton, ListSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { appDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { LEAVE_STATUS_LABELS, LEAVE_STATUSES, type LeaveStatus } from '@/types/hr'
import { useLeaveBalances, useLeaveLedger, useMyLeaveRequests } from '../api/use-leave'
import { BalanceCards } from '../components/balance-cards'
import { LeaveRequestList } from '../components/leave-request-list'
import { LedgerTable } from '../components/ledger-table'
import { leaveYearOf } from '../lib/leave-policy'

export function MyLeavePage() {
  const [year] = useState(() => leaveYearOf(appDateKey(new Date())))
  const balances = useLeaveBalances(null, year)
  const requests = useMyLeaveRequests()
  const ledger = useLeaveLedger(null, year)
  const [status, setStatus] = useState<LeaveStatus | ''>('')
  const statusId = useId()
  const rows = (requests.data ?? []).filter((r) => !status || r.status === status)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My leave"
        description={`Your balances and requests for the ${year} leave year.`}
        actions={
          <Button asChild>
            <Link to="/leave/apply">
              <Plus aria-hidden="true" />
              Apply for leave
            </Link>
          </Button>
        }
      />
      <SectionCard title="Balances" description={`Leave year ${year} (January to December)`}>
        {balances.isPending ? (
          <CardSkeleton lines={2} />
        ) : balances.isError ? (
          <ErrorState
            title="Could not load your balances"
            message={userMessage(balances.error)}
            onRetry={() => void balances.refetch()}
          />
        ) : (
          <BalanceCards balances={balances.data} />
        )}
      </SectionCard>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <SectionCard
            title="My requests"
            contentClassName="p-0"
            actions={
              <div className="flex items-center gap-2">
                <Label htmlFor={statusId} className="text-xs">
                  Status
                </Label>
                <NativeSelect
                  id={statusId}
                  placeholder="All"
                  value={status}
                  options={LEAVE_STATUSES.filter((s) => s !== 'draft').map((s) => ({
                    value: s,
                    label: LEAVE_STATUS_LABELS[s],
                  }))}
                  onChange={(e) => setStatus(e.target.value as LeaveStatus | '')}
                />
              </div>
            }
          >
            {requests.isPending ? (
              <ListSkeleton rows={4} className="border-0" />
            ) : requests.isError ? (
              <div className="p-4">
                <ErrorState
                  title="Could not load your requests"
                  message={userMessage(requests.error)}
                  onRetry={() => void requests.refetch()}
                />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={status ? 'No requests with this status' : 'No leave requests yet'}
                  description="Requests you submit appear here with their status."
                />
              </div>
            ) : (
              <LeaveRequestList requests={rows} caption="My leave requests" showEmployee={false} />
            )}
          </SectionCard>
        </TabsContent>
        <TabsContent value="ledger">
          <SectionCard
            title="Ledger"
            description="Every change to your balances: allocations, approved leave, returned days and HR adjustments."
          >
            {ledger.isPending ? (
              <ListSkeleton rows={4} />
            ) : ledger.isError ? (
              <ErrorState
                message={userMessage(ledger.error)}
                onRetry={() => void ledger.refetch()}
              />
            ) : (
              <LedgerTable entries={ledger.data} caption="My leave ledger" />
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
