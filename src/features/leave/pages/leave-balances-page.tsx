// HR leave balances (P5-T05 HR view, P5-T15): any employee's balances and ledger, and allocation
// adjustments with a reason. The 7/7/7 policy allocation is shown read-only (D-060); leave-year
// rules (proration, carry-forward, expiry) are not built yet (provisional D-090).
import { SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton, ListSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useReportingLines } from '@/features/organization'
import { appDateKey } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { ANNUAL_LEAVE_ALLOWANCE, LEAVE_TYPE_LABELS, LEAVE_TYPES } from '@/types/hr'
import { useLeaveBalances, useLeaveLedger } from '../api/use-leave'
import { AdjustAllocationDialog } from '../components/adjust-allocation-dialog'
import { BalanceCards } from '../components/balance-cards'
import { LedgerTable } from '../components/ledger-table'
import { leaveYearOf } from '../lib/leave-policy'

function EmployeeBalances({
  employee,
  year,
}: {
  employee: { id: string; name: string }
  year: number
}) {
  const balances = useLeaveBalances(employee.id, year)
  const ledger = useLeaveLedger(employee.id, year)
  const [adjusting, setAdjusting] = useState(false)
  return (
    <>
      <SectionCard
        title={`${employee.name}: balances ${year}`}
        actions={
          <Button size="sm" variant="outline" onClick={() => setAdjusting(true)}>
            <SlidersHorizontal aria-hidden="true" />
            Adjust allocation
          </Button>
        }
      >
        {balances.isPending ? (
          <CardSkeleton lines={2} />
        ) : balances.isError ? (
          <ErrorState
            message={userMessage(balances.error)}
            onRetry={() => void balances.refetch()}
          />
        ) : (
          <BalanceCards balances={balances.data} />
        )}
      </SectionCard>
      <SectionCard title="Ledger" description="Every change to this person’s balances.">
        {ledger.isPending ? (
          <ListSkeleton rows={4} />
        ) : ledger.isError ? (
          <ErrorState message={userMessage(ledger.error)} onRetry={() => void ledger.refetch()} />
        ) : (
          <LedgerTable entries={ledger.data} caption={`Leave ledger of ${employee.name}`} />
        )}
      </SectionCard>
      <AdjustAllocationDialog
        employee={employee}
        year={year}
        open={adjusting}
        onOpenChange={setAdjusting}
      />
    </>
  )
}

export function LeaveBalancesPage() {
  const [year] = useState(() => leaveYearOf(appDateKey(new Date())))
  const people = useReportingLines()
  const [employeeId, setEmployeeId] = useState('')
  const pickerId = useId()
  const active = (people.data ?? [])
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name))
  const employee = active.find((p) => p.id === employeeId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave balances"
        description="Look up anyone’s balances and ledger, and adjust allocations with a reason."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Look up an employee" className="lg:col-span-2">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor={pickerId}>Employee</Label>
            <NativeSelect
              id={pickerId}
              placeholder={people.isPending ? 'Loading…' : 'Choose an employee'}
              value={employeeId}
              options={active.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
          </div>
        </SectionCard>
        <SectionCard title="Policy allocation" description={`Every employee, leave year ${year}`}>
          <ul className="space-y-1 text-sm">
            {LEAVE_TYPES.map((t) => (
              <li key={t} className="flex justify-between">
                <span>{LEAVE_TYPE_LABELS[t]}</span>
                <span className="font-medium tabular-nums">{ANNUAL_LEAVE_ALLOWANCE[t]} days</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Calendar year, no proration or carry-forward yet (open questions). Changing the policy
            for everyone comes with Settings.
          </p>
        </SectionCard>
      </div>
      {people.isError ? (
        <ErrorState message={userMessage(people.error)} onRetry={() => void people.refetch()} />
      ) : employee ? (
        <EmployeeBalances key={employee.id} employee={employee} year={year} />
      ) : (
        <EmptyState
          title="Choose an employee"
          description="Their balances and ledger appear here."
        />
      )}
    </div>
  )
}
