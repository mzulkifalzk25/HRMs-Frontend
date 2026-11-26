import { describe, expect, it } from 'vitest'
import { balanceAfter, balanceOf, computeBalances, fitsBalance, type LedgerLine } from './balance'

const line = (kind: LedgerLine['kind'], days: number, extra: Partial<LedgerLine> = {}) =>
  ({ employeeId: 'e-1', leaveType: 'casual', year: 2026, kind, days, ...extra }) as LedgerLine

const allocations: LedgerLine[] = [
  line('allocation', 7, { leaveType: 'medical_sick' }),
  line('allocation', 7, { leaveType: 'casual' }),
  line('allocation', 7, { leaveType: 'annual' }),
]

describe('leave balances from the ledger (D-060…D-062, D-088)', () => {
  it('starts at the 7/7/7 allocation with nothing used', () => {
    expect(computeBalances(allocations, 'e-1', 2026)).toEqual([
      { leaveType: 'medical_sick', allocated: 7, used: 0, remaining: 7 },
      { leaveType: 'casual', allocated: 7, used: 0, remaining: 7 },
      { leaveType: 'annual', allocated: 7, used: 0, remaining: 7 },
    ])
  })

  it('deducts approved leave from its own category only', () => {
    const b = computeBalances([...allocations, line('deduction', 3)], 'e-1', 2026)
    expect(balanceOf(b, 'casual')).toEqual({
      leaveType: 'casual',
      allocated: 7,
      used: 3,
      remaining: 4,
    })
    expect(balanceOf(b, 'annual').remaining).toBe(7)
    expect(balanceOf(b, 'medical_sick').remaining).toBe(7)
  })

  it('restores days on a cancellation reversal and applies HR adjustments', () => {
    const b = computeBalances(
      [
        ...allocations,
        line('deduction', 2),
        line('reversal', 2),
        line('adjustment', 2, { leaveType: 'annual' }),
        line('adjustment', -1, { leaveType: 'medical_sick' }),
      ],
      'e-1',
      2026,
    )
    expect(balanceOf(b, 'casual')).toMatchObject({ used: 0, remaining: 7 })
    expect(balanceOf(b, 'annual')).toMatchObject({ allocated: 9, remaining: 9 })
    expect(balanceOf(b, 'medical_sick')).toMatchObject({ allocated: 6, remaining: 6 })
  })

  it('keeps people and years apart', () => {
    const entries = [
      ...allocations,
      line('deduction', 5, { employeeId: 'e-2' }),
      line('deduction', 4, { year: 2025 }),
    ]
    expect(balanceOf(computeBalances(entries, 'e-1', 2026), 'casual').remaining).toBe(7)
    expect(balanceOf(computeBalances(entries, 'e-2', 2026), 'casual').allocated).toBe(0)
  })

  it('always reconciles: remaining = allocated − used', () => {
    const entries = [
      ...allocations,
      line('deduction', 1),
      line('deduction', 2),
      line('reversal', 1),
    ]
    for (const b of computeBalances(entries, 'e-1', 2026)) {
      expect(b.remaining).toBe(b.allocated - b.used)
    }
  })

  it('refuses requests beyond the remaining days (no negative balances, D-088)', () => {
    const casual = { leaveType: 'casual' as const, allocated: 7, used: 5, remaining: 2 }
    expect(fitsBalance(casual, 2)).toBe(true)
    expect(fitsBalance(casual, 3)).toBe(false)
    expect(balanceAfter(casual, 2)).toEqual({ ...casual, used: 7, remaining: 0 })
  })
})
