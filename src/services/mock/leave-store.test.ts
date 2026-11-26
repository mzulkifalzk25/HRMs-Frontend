// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import type { Role } from '@/features/authentication/types'
import { computeBalances, balanceOf } from '@/features/leave/lib/balance'
import {
  approvalTaskSchema,
  leaveBalanceSchema,
  leaveRequestDetailSchema,
  ledgerEntrySchema,
  type LeaveRequestDetail,
} from '@/features/leave/schemas/leave.schema'
import type { ApiError } from '@/services/api'
import { createHrStore } from './hr-store'
import { createLeaveStore, type LeaveStore, type MockLeaveApplication } from './leave-store'
import { setMockViewer } from './mock-session'

const ACCOUNTS: Record<Role, string> = {
  hr_admin: 'u-hr-001',
  manager: 'u-mgr-001',
  senior_pm: 'u-spm-001',
  associate_pm: 'u-apm-001',
  team_lead: 'u-tl-001',
  employee: 'u-emp-001',
}
const as = (role: Role) => setMockViewer({ id: ACCOUNTS[role], role })
const asPerson = (id: string, role: Role) => setMockViewer({ id, role })

// Wednesday 25 Nov 2026, 11:00 PKT.
let nowIso = '2026-11-25T06:00:00Z'
let store: LeaveStore
beforeEach(() => {
  nowIso = '2026-11-25T06:00:00Z'
  store = createLeaveStore({ hr: createHrStore(), now: () => new Date(nowIso) })
  setMockViewer(null)
})

function apiError(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (error) {
    return error as ApiError
  }
  throw new Error('Expected an ApiError')
}

const application = (extra: Partial<MockLeaveApplication> = {}): MockLeaveApplication => ({
  leaveType: 'casual',
  startDate: '2026-12-14', // Monday
  endDate: '2026-12-15',
  requestedDays: 2,
  reason: 'Family wedding',
  managerIds: ['u-mgr-001'],
  attachment: null,
  ...extra,
})

const approveAs = (r: LeaveRequestDetail, id: string, role: Role) => {
  asPerson(id, role)
  return store.act(r.id, { action: 'approve', comment: null, version: store.get(r.id).version })
}

describe('seed data and ledger', () => {
  it('matches the contract and reconciles every balance with the ledger', () => {
    as('hr_admin')
    const page = store.list({ page: 1, pageSize: 100 })
    expect(page.count).toBeGreaterThanOrEqual(10)
    for (const r of page.results) leaveRequestDetailSchema.parse(store.get(r.id))
    for (const employeeId of ['u-emp-001', 'e-102', 'e-105']) {
      const entries = store.ledger({ employeeId, year: 2026 })
      entries.forEach((e) => ledgerEntrySchema.parse(e))
      const balances = store.balances({ employeeId, year: 2026 })
      balances.forEach((b) => leaveBalanceSchema.parse(b))
      expect(balances).toEqual(computeBalances(entries, employeeId, 2026))
      for (const b of balances) expect(b.remaining).toBe(b.allocated - b.used)
    }
  })

  it('deducts only approved leave, from its own category (D-061)', () => {
    as('employee')
    const balances = store.balances({ year: 2026 })
    expect(balanceOf(balances, 'casual')).toEqual({
      leaveType: 'casual',
      allocated: 7,
      used: 1,
      remaining: 6,
    })
    expect(balanceOf(balances, 'annual').used).toBe(0) // the declined request never deducted
    expect(store.mine().map((r) => r.status)).toEqual(['declined', 'approved'])
  })

  it('knows who is on approved leave today', () => {
    expect(store.isOnLeave('e-102', '2026-11-25')).toBe(true)
    expect(store.isOnLeave('e-101', '2026-11-25')).toBe(false)
    as('hr_admin')
    expect(store.summary().onLeaveToday).toBe(1)
  })
})

describe('routing preview (D-089)', () => {
  it('employee: manager decides, Team Lead and Associate PM review, HR always notified', () => {
    as('employee')
    const preview = store.previewRoute(null)
    expect(preview.routedTo).toBe('managers')
    expect(preview.participants).toEqual([
      { employeeId: 'u-mgr-001', name: 'Imran Demo', kind: 'decision_maker', mandatory: false },
      { employeeId: 'u-tl-001', name: 'Zainab Demo', kind: 'reviewer', mandatory: false },
      { employeeId: 'u-apm-001', name: 'Usman Demo', kind: 'reviewer', mandatory: false },
      { employeeId: 'u-hr-001', name: 'Sana Demo', kind: 'recipient', mandatory: true },
    ])
  })

  it('manager and Senior PM go to HR; Associate PM to the Senior PM', () => {
    as('manager')
    expect(store.previewRoute(null).routedTo).toBe('hr')
    as('senior_pm')
    expect(store.previewRoute(null).routedTo).toBe('hr')
    as('associate_pm')
    const apm = store.previewRoute(null)
    expect(apm.routedTo).toBe('senior_pm')
    expect(apm.participants[0]).toMatchObject({ employeeId: 'u-spm-001', kind: 'decision_maker' })
  })

  it('the only HR Administrator cannot submit: nobody else could decide', () => {
    as('hr_admin')
    expect(store.previewRoute(null).problem).toMatch(/no other HR Administrator/)
    expect(apiError(() => store.submit(application({ managerIds: [] }))).code).toBe('no_approver')
  })
})

describe('submission rules (D-088)', () => {
  it.each([
    [{ endDate: '2026-12-11', startDate: '2026-12-14' }, 'endDate', /on or after/],
    [
      { startDate: '2026-12-12', endDate: '2026-12-13', requestedDays: 0 },
      'endDate',
      /no working days/,
    ],
    [{ requestedDays: 5 }, 'requestedDays', /2 working days/],
    [{ startDate: '2026-12-31', endDate: '2027-01-01' }, 'endDate', /one leave year/],
    [{ reason: 'no' }, 'reason', /at least 5/],
    [
      { attachment: { name: 'a.exe', size: 10, contentType: 'application/x-msdownload' } },
      'attachment',
      /PDF, JPG or PNG/,
    ],
    [
      { attachment: { name: 'a.pdf', size: 6 * 1024 * 1024, contentType: 'application/pdf' } },
      'attachment',
      /5 MB/,
    ],
    [{ managerIds: [] }, 'managerIds', /at least one manager/],
    [{ managerIds: ['u-spm-001'] }, 'managerIds', /your own managers/],
    [
      {
        leaveType: 'casual' as const,
        startDate: '2026-12-14',
        endDate: '2026-12-22',
        requestedDays: 7,
      },
      'leaveType',
      /Only 6 Casual days remain/,
    ],
  ])('%o → %s', (extra, field, message) => {
    as('employee')
    const error = apiError(() => store.submit(application(extra)))
    expect(error.status).toBe(400)
    expect(error.fieldErrors?.[field]?.[0]).toMatch(message)
  })

  it('refuses overlaps with own pending or approved leave, allows backdated leave', () => {
    as('employee')
    store.submit(application())
    const overlap = apiError(() =>
      store.submit(application({ startDate: '2026-12-15', endDate: '2026-12-16' })),
    )
    expect(overlap.fieldErrors?.startDate?.[0]).toMatch(/already have leave/)
    const past = store.submit(
      application({
        leaveType: 'medical_sick',
        startDate: '2026-11-23',
        endDate: '2026-11-23',
        requestedDays: 1,
      }),
    )
    expect(past).toMatchObject({ backdated: true, status: 'pending' })
  })

  it('creates a pending request routed to the selected manager, with HR notified', () => {
    as('employee')
    const created = store.submit(
      application({ attachment: { name: 'note.pdf', size: 100, contentType: 'application/pdf' } }),
    )
    expect(created).toMatchObject({
      status: 'pending',
      routedTo: 'managers',
      requestedDays: 2,
      backdated: false,
      allowedActions: ['cancel'],
      attachment: { name: 'note.pdf' },
    })
    expect(created.participants.find((p) => p.kind === 'recipient')).toMatchObject({
      employeeId: 'u-hr-001',
      mandatory: true,
    })
  })
})

describe('approvals (D-065, D-068, D-069, D-089)', () => {
  function submitted() {
    as('employee')
    return store.submit(application())
  }

  it('reviewer recommends, manager approves; one deduction only; repeat is 409', () => {
    const r = submitted()
    as('team_lead')
    const tasks = store.inbox('pending')
    tasks.forEach((t) => approvalTaskSchema.parse(t))
    expect(tasks.find((t) => t.id === r.id)?.stage).toBe('recommendation')
    const reviewed = store.act(r.id, {
      action: 'recommend_approve',
      comment: 'Fine by me',
      version: r.version,
    })
    expect(reviewed.status).toBe('under_review')

    as('manager')
    expect(store.inbox('pending').find((t) => t.id === r.id)?.stage).toBe('final_approval')
    const approved = approveAs(r, 'u-mgr-001', 'manager')
    expect(approved.status).toBe('approved')
    expect(store.inbox('history').map((t) => t.id)).toContain(r.id)

    const again = apiError(() =>
      store.act(r.id, { action: 'approve', comment: null, version: approved.version }),
    )
    expect(again).toMatchObject({ status: 409, code: 'already_decided' })
    as('employee')
    const deductions = store.ledger({ year: 2026 }).filter((e) => e.requestId === r.id)
    expect(deductions).toMatchObject([{ kind: 'deduction', days: 2, actorName: 'Imran Demo' }])
    expect(balanceOf(store.balances({ year: 2026 }), 'casual').remaining).toBe(4)
  })

  it('a stale version answers 409 conflict (concurrent decision)', () => {
    const r = submitted()
    as('team_lead')
    store.act(r.id, { action: 'comment', comment: 'Checking coverage', version: r.version })
    as('manager')
    expect(
      apiError(() => store.act(r.id, { action: 'approve', comment: null, version: r.version })),
    ).toMatchObject({
      status: 409,
      code: 'conflict',
    })
  })

  it('declining needs a reason and never deducts', () => {
    const r = submitted()
    as('manager')
    expect(
      apiError(() => store.act(r.id, { action: 'decline', comment: ' ', version: r.version }))
        .fieldErrors?.comment?.[0],
    ).toMatch(/reason/)
    const declined = store.act(r.id, {
      action: 'decline',
      comment: 'Busy release week',
      version: r.version,
    })
    expect(declined.status).toBe('declined')
    as('employee')
    expect(store.ledger({ year: 2026 }).some((e) => e.requestId === r.id)).toBe(false)
  })

  it('nobody approves their own request; outsiders cannot act', () => {
    as('manager')
    const own = store.submit(application({ managerIds: [] }))
    expect(own.routedTo).toBe('hr')
    expect(
      apiError(() => store.act(own.id, { action: 'approve', comment: null, version: 0 })).status,
    ).toBe(403)
    const r = submitted()
    as('senior_pm') // Ali is in Farah's project scope (she can see it) but she does not decide
    const error = apiError(() =>
      store.act(r.id, { action: 'approve', comment: null, version: r.version }),
    )
    expect(error.status).toBe(403)
  })

  it('with two managers, the first decision is final (any one decides)', () => {
    as('hr_admin')
    const bilal = store.list({ page: 1, pageSize: 50, employeeId: 'e-103' }).results[0]
    expect(bilal).toBeDefined()
    as('senior_pm')
    const id = bilal?.id ?? ''
    store.act(id, {
      action: 'decline',
      comment: 'Project deadline that day',
      version: store.get(id).version,
    })
    as('manager')
    expect(
      apiError(() =>
        store.act(id, { action: 'approve', comment: null, version: store.get(id).version }),
      ).code,
    ).toBe('already_decided')
  })

  it('HR may override with a reason (D-089)', () => {
    as('hr_admin')
    const nida = store.list({ page: 1, pageSize: 50, employeeId: 'e-108' }).results[0]
    const id = nida?.id ?? ''
    expect(store.get(id).allowedActions).toEqual([
      'comment',
      'override_approve',
      'override_decline',
    ])
    expect(
      apiError(() => store.act(id, { action: 'override_approve', comment: null, version: 0 }))
        .status,
    ).toBe(400)
    const decided = store.act(id, {
      action: 'override_approve',
      comment: 'Senior PM on leave; approved by HR',
      version: 0,
    })
    expect(decided.status).toBe('approved')
    expect(
      store.ledger({ employeeId: 'e-108', year: 2026 }).filter((e) => e.kind === 'deduction'),
    ).toHaveLength(1)
  })

  it('approval is refused when the balance no longer covers the request (no reservation)', () => {
    as('employee')
    const first = store.submit(
      application({ startDate: '2026-12-14', endDate: '2026-12-17', requestedDays: 4 }),
    )
    const second = store.submit(
      application({ startDate: '2026-12-21', endDate: '2026-12-24', requestedDays: 4 }),
    )
    approveAs(first, 'u-mgr-001', 'manager')
    const error = apiError(() => approveAs(second, 'u-mgr-001', 'manager'))
    expect(error).toMatchObject({ status: 409, code: 'insufficient_balance' })
    expect(store.get(second.id).status).toBe('pending')
  })
})

describe('cancellation (D-088)', () => {
  it('pending: cancelled without ledger change', () => {
    as('employee')
    const r = store.submit(application())
    const cancelled = store.cancel(r.id, { reason: null, version: r.version })
    expect(cancelled).toMatchObject({ status: 'cancelled', allowedActions: [] })
  })

  it('approved: until the day before the start, with the days returned', () => {
    as('employee')
    const r = store.submit(application())
    const approved = approveAs(r, 'u-mgr-001', 'manager')
    as('employee')
    expect(store.cancel(r.id, { reason: 'Plans changed', version: approved.version }).status).toBe(
      'cancelled',
    )
    const entries = store.ledger({ year: 2026 }).filter((e) => e.requestId === r.id)
    expect(entries.map((e) => e.kind).sort()).toEqual(['deduction', 'reversal'])
    expect(balanceOf(store.balances({ year: 2026 }), 'casual').remaining).toBe(6)
  })

  it('approved leave that has started cannot be cancelled; others cannot cancel', () => {
    asPerson('e-102', 'employee')
    const mariam = store.mine()[0]
    const id = mariam?.id ?? ''
    expect(
      apiError(() => store.cancel(id, { reason: null, version: store.get(id).version })).code,
    ).toBe('cannot_cancel')
    as('manager')
    expect(apiError(() => store.cancel(id, { reason: null, version: 1 })).status).toBe(403)
  })
})

describe('scope and HR allocation (D-044, D-062)', () => {
  it('employees have no list (403) and cannot open others’ requests (404)', () => {
    as('employee')
    expect(apiError(() => store.list({ page: 1, pageSize: 10 })).status).toBe(403)
    asPerson('e-112', 'employee')
    const kamran = store.mine()[0]
    as('employee')
    expect(apiError(() => store.get(kamran?.id ?? '')).status).toBe(404)
    expect(apiError(() => store.balances({ employeeId: 'e-112', year: 2026 })).status).toBe(403)
  })

  it('a manager sees their team’s requests only', () => {
    as('manager')
    const names = new Set(store.list({ page: 1, pageSize: 100 }).results.map((r) => r.employeeName))
    expect(names.has('Kamran Aslam')).toBe(false)
    expect(names.has('Hamza Kareem')).toBe(true)
  })

  it('HR adjusts allocations with a reason; never below what is used', () => {
    as('manager')
    expect(
      apiError(() =>
        store.adjustAllocation({
          employeeId: 'u-emp-001',
          leaveType: 'annual',
          year: 2026,
          days: 2,
          reason: 'Long service',
        }),
      ).status,
    ).toBe(403)
    as('hr_admin')
    const entry = store.adjustAllocation({
      employeeId: 'u-emp-001',
      leaveType: 'annual',
      year: 2026,
      days: 2,
      reason: 'Long service award',
    })
    expect(entry).toMatchObject({ kind: 'adjustment', days: 2, actorName: 'Sana Demo' })
    expect(
      balanceOf(store.balances({ employeeId: 'u-emp-001', year: 2026 }), 'annual').allocated,
    ).toBe(9)
    expect(
      apiError(() =>
        store.adjustAllocation({
          employeeId: 'u-emp-001',
          leaveType: 'casual',
          year: 2026,
          days: -7,
          reason: 'Correction',
        }),
      ).fieldErrors?.days?.[0],
    ).toMatch(/already used \(1\)/)
    expect(
      apiError(() =>
        store.adjustAllocation({
          employeeId: 'u-emp-001',
          leaveType: 'casual',
          year: 2026,
          days: 1,
          reason: '',
        }),
      ).fieldErrors?.reason,
    ).toBeDefined()
  })
})
