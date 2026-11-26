// Leave balances from the ledger (P5-T02, P5-T03; D-060…D-062, D-088). Pure and deterministic:
// allocated = allocations + HR adjustments; used = approval deductions − cancellation reversals;
// remaining = allocated − used. Only approved leave deducts; pending, declined and cancelled
// requests never appear in the ledger. Each category is independent.
import { LEAVE_TYPES, type LeaveType } from '@/types/hr'
import { LEAVE_POLICY } from './leave-policy'

export const LEDGER_KINDS = ['allocation', 'adjustment', 'deduction', 'reversal'] as const
export type LedgerKind = (typeof LEDGER_KINDS)[number]

/** The fields of a ledger entry the balance depends on. */
export type LedgerLine = {
  employeeId: string
  leaveType: LeaveType
  year: number
  kind: LedgerKind
  /** Positive for allocation/deduction/reversal; signed for adjustments. */
  days: number
}

export type Balance = { leaveType: LeaveType; allocated: number; used: number; remaining: number }

export function computeBalances(
  entries: readonly LedgerLine[],
  employeeId: string,
  year: number,
): Balance[] {
  return LEAVE_TYPES.map((leaveType) => {
    let allocated = 0
    let used = 0
    for (const e of entries) {
      if (e.employeeId !== employeeId || e.year !== year || e.leaveType !== leaveType) continue
      if (e.kind === 'allocation' || e.kind === 'adjustment') allocated += e.days
      else if (e.kind === 'deduction') used += e.days
      else used -= e.days
    }
    return { leaveType, allocated, used, remaining: allocated - used }
  })
}

export function balanceOf(balances: readonly Balance[], leaveType: LeaveType): Balance {
  return (
    balances.find((b) => b.leaveType === leaveType) ?? {
      leaveType,
      allocated: 0,
      used: 0,
      remaining: 0,
    }
  )
}

/** Whether a request of `days` fits the balance (no negative balances, D-088). */
export function fitsBalance(balance: Balance, days: number): boolean {
  return LEAVE_POLICY.allowNegativeBalance || days <= balance.remaining
}

/** Balance after deducting `days` (preview on the form and in approval dialogs). */
export function balanceAfter(balance: Balance, days: number): Balance {
  return { ...balance, used: balance.used + days, remaining: balance.remaining - days }
}
