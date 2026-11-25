// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import {
  attendanceRecordSchema,
  attendanceSummarySchema,
  correctionEntrySchema,
} from '@/features/attendance/schemas/attendance.schema'
import type { Role } from '@/features/authentication/types'
import { createAttendanceStore, type AttendanceStore } from './attendance-store'
import { createHrStore } from './hr-store'
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

// Wednesday 25 Nov 2026; the clock is moved per test.
let nowIso = '2026-11-25T04:00:00Z' // 09:00 PKT
let store: AttendanceStore
beforeEach(() => {
  nowIso = '2026-11-25T04:00:00Z'
  setMockViewer({ id: 'u-hr-001', role: 'hr_admin' }) // seeding reads people via the HR store
  store = createAttendanceStore({ hr: createHrStore(), now: () => new Date(nowIso) })
  setMockViewer(null)
})

const range = { from: '2026-10-25', to: '2026-11-25' }

describe('seed data', () => {
  it('matches the contract, covers ~30 days and leaves demo accounts unchecked today', () => {
    as('hr_admin')
    const page = store.list({ ...range, page: 1, pageSize: 1000 })
    expect(page.count).toBeGreaterThan(200)
    for (const r of page.results) attendanceRecordSchema.parse(r)
    expect(store.today().record).toBeNull()
    expect(page.results.some((r) => r.checkInStatus === 'late')).toBe(true)
    expect(page.results.some((r) => r.checkInAt && !r.checkOutAt && r.date < '2026-11-25')).toBe(
      true,
    )
  })
})

describe('check-in and check-out (server time, single session)', () => {
  it('classifies 09:15:00 as on time and 09:15:01 as late', () => {
    as('employee')
    nowIso = '2026-11-25T04:15:00Z'
    expect(store.checkIn()).toMatchObject({
      date: '2026-11-25',
      checkInStatus: 'on_time',
      checkOutAt: null,
    })
    as('manager')
    nowIso = '2026-11-25T04:15:01Z'
    expect(store.checkIn().checkInStatus).toBe('late')
  })

  it('rejects a second check-in and checkout without check-in', () => {
    as('employee')
    expect(() => store.checkOut()).toThrow(
      expect.objectContaining({ status: 400, code: 'not_checked_in' }),
    )
    store.checkIn()
    expect(() => store.checkIn()).toThrow(
      expect.objectContaining({ status: 409, code: 'already_checked_in' }),
    )
  })

  it('records the exact duration and the checkout window', () => {
    as('employee')
    nowIso = '2026-11-25T04:07:13Z' // 09:07:13
    store.checkIn()
    nowIso = '2026-11-25T12:44:59Z' // 17:44:59
    const out = store.checkOut()
    expect(out.durationMs).toBe(((8 * 60 + 37) * 60 + 46) * 1000)
    expect(out.checkOutStatus).toBe('before_window') // unclassified, no penalty (Q-ATT-01)
    expect(() => store.checkOut()).toThrow(expect.objectContaining({ status: 409 }))
  })
})

describe('scope', () => {
  it('employees cannot list team records but see their own', () => {
    as('employee')
    expect(() => store.list({ ...range, page: 1, pageSize: 10 })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
    expect(store.mine(range.from, range.to).every((r) => r.employeeId === 'u-emp-001')).toBe(true)
  })

  it('a team lead sees only their team; others look like they do not exist (404)', () => {
    as('team_lead')
    const rows = store.list({ ...range, page: 1, pageSize: 1000 }).results
    expect(new Set(rows.map((r) => r.employeeId))).toEqual(new Set(['e-101', 'e-103', 'u-emp-001']))
    as('hr_admin')
    const finance = store.list({ ...range, page: 1, pageSize: 1, departmentId: 'd-fin' }).results[0]
    as('team_lead')
    expect(() => store.get(finance?.id ?? '')).toThrow(expect.objectContaining({ status: 404 }))
  })

  it('filters by late, incomplete, department and employee', () => {
    as('hr_admin')
    const q = { ...range, page: 1, pageSize: 1000 }
    expect(
      store.list({ ...q, filter: 'late' }).results.every((r) => r.checkInStatus === 'late'),
    ).toBe(true)
    expect(
      store
        .list({ ...q, filter: 'incomplete' })
        .results.every((r) => !r.checkOutAt && r.date < '2026-11-25'),
    ).toBe(true)
    expect(
      store.list({ ...q, employeeId: 'e-101' }).results.every((r) => r.employeeId === 'e-101'),
    ).toBe(true)
  })
})

describe('corrections (HR only, mandatory reason, audited)', () => {
  function anyIncomplete() {
    as('hr_admin')
    const record = store.list({ ...range, page: 1, pageSize: 1, filter: 'incomplete' }).results[0]
    if (!record?.checkInAt) throw new Error('seed has no incomplete record')
    return record
  }

  it('rejects non-HR and a missing reason', () => {
    const record = anyIncomplete()
    as('manager')
    expect(() =>
      store.correct(record.id, { checkInAt: record.checkInAt, checkOutAt: null, reason: 'x' }),
    ).toThrow(expect.objectContaining({ status: 403 }))
    as('hr_admin')
    expect(() =>
      store.correct(record.id, { checkInAt: record.checkInAt, checkOutAt: null, reason: ' ' }),
    ).toThrow(
      expect.objectContaining({ fieldErrors: { reason: ['Give a reason for this correction.'] } }),
    )
  })

  it('rejects times on another day or a checkout before check-in', () => {
    const record = anyIncomplete()
    as('hr_admin')
    expect(() =>
      store.correct(record.id, {
        checkInAt: record.checkInAt,
        checkOutAt: '2030-01-01T13:00:00+05:00',
        reason: 'Fix it',
      }),
    ).toThrow(
      expect.objectContaining({
        fieldErrors: { checkOutAt: ['The time must be on the same day as the record.'] },
      }),
    )
    const before = `${record.date}T08:00:00+05:00`
    expect(() =>
      store.correct(record.id, {
        checkInAt: record.checkInAt,
        checkOutAt: before,
        reason: 'Fix it',
      }),
    ).toThrow(
      expect.objectContaining({
        fieldErrors: { checkOutAt: ['Check-out must be after check-in.'] },
      }),
    )
  })

  it('applies the correction, reclassifies, and records before/after with the actor', () => {
    const record = anyIncomplete()
    as('hr_admin')
    nowIso = '2026-11-25T06:00:00Z'
    const checkOutAt = `${record.date}T18:05:00+05:00`
    const updated = store.correct(record.id, {
      checkInAt: record.checkInAt,
      checkOutAt,
      reason: 'Forgot to check out',
    })
    expect(updated).toMatchObject({ corrected: true, checkOutStatus: 'within_window' })
    expect(updated.durationMs).toBeGreaterThan(0)
    const [entry] = store.corrections(record.id)
    correctionEntrySchema.parse(entry)
    expect(entry).toMatchObject({
      actorName: 'Sana Demo',
      reason: 'Forgot to check out',
      before: { checkInAt: record.checkInAt, checkOutAt: null },
      after: { checkInAt: record.checkInAt, checkOutAt: updated.checkOutAt },
    })
  })
})

describe('summary', () => {
  it('counts today within the scope; absent stays provisional', () => {
    as('employee')
    store.checkIn()
    as('hr_admin')
    const summary = attendanceSummarySchema.parse(store.summary())
    expect(summary.present).toBeGreaterThanOrEqual(1)
    expect(summary.present + summary.notCheckedIn).toBe(summary.total)
    expect(summary.absent).toBe(0)
    as('employee')
    expect(store.summary()).toMatchObject({ total: 1, present: 1 })
  })
})
