// @vitest-environment node
// Audit, settings and reports mock backends (Phase 8).
import { beforeEach, describe, expect, it } from 'vitest'
import { auditEntrySchema } from '@/features/audit/schemas/audit.schema'
import type { ApiError } from '@/services/api'
import { mockAuditStore } from './audit-store'
import { mockAttendanceStore } from './attendance-store'
import { mockHrStore } from './hr-store'
import { mockLeaveStore } from './leave-store'
import { setMockViewer } from './mock-session'
import { mockNotificationStore } from './notification-store'
import { mockReportStore } from './report-store'
import { mockSettingsStore } from './settings-store'

const hr = () => setMockViewer({ id: 'u-hr-001', role: 'hr_admin' })
beforeEach(() => {
  setMockViewer(null)
  mockHrStore.reset()
  mockSettingsStore.reset()
  mockNotificationStore.reset()
  mockLeaveStore.reset()
  mockAttendanceStore.reset()
  mockAuditStore.reset()
})

function apiError(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (error) {
    return error as ApiError
  }
  throw new Error('Expected an ApiError')
}
const page = { page: 1, pageSize: 100 }

describe('audit log', () => {
  it('starts empty (no invented history) and is HR only', () => {
    hr()
    expect(mockAuditStore.list(page).count).toBe(0)
    setMockViewer({ id: 'u-mgr-001', role: 'manager' })
    expect(apiError(() => mockAuditStore.list(page)).status).toBe(403)
  })

  it('records employee changes with before/after, append-only', () => {
    hr()
    mockHrStore.updateEmployee('e-101', { phone: '+92 300 1111111' })
    const [entry] = mockAuditStore.list(page).results
    auditEntrySchema.parse(entry)
    expect(entry).toMatchObject({
      action: 'updated',
      entity: 'employee',
      actorName: 'Sana Demo',
      before: { Phone: '' },
      after: { Phone: '+92 300 1111111' },
    })
    expect(Object.isFrozen(entry)).toBe(true)
  })

  it('records leave decisions and the balance deduction', () => {
    setMockViewer({ id: 'u-emp-001', role: 'employee' })
    const r = mockLeaveStore.submit({
      leaveType: 'casual',
      startDate: '2026-12-14',
      endDate: '2026-12-14',
      requestedDays: 1,
      reason: 'Family event',
      managerIds: ['u-mgr-001'],
      attachment: null,
    })
    setMockViewer({ id: 'u-mgr-001', role: 'manager' })
    mockLeaveStore.act(r.id, { action: 'approve', comment: null, version: r.version })
    hr()
    const actions = mockAuditStore
      .list({ ...page, sort: 'oldest' })
      .results.map((e) => `${e.entity}:${e.action}`)
    expect(actions).toEqual(['leave_balance:adjusted', 'leave_request:approved'])
  })
})

describe('settings', () => {
  it('only HR changes settings; changes are validated and audited', () => {
    setMockViewer({ id: 'u-mgr-001', role: 'manager' })
    expect(mockSettingsStore.get().company.timezone).toBe('Asia/Karachi')
    expect(
      apiError(() => mockSettingsStore.addHoliday({ date: '2026-12-25', name: 'Holiday' })).status,
    ).toBe(403)
    hr()
    expect(
      apiError(() =>
        mockSettingsStore.updateCompany({
          companyName: 'X',
          legalName: '',
          contactEmail: 'bad',
          phone: '',
          address: '',
        }),
      ).fieldErrors,
    ).toMatchObject({ companyName: expect.any(Array), contactEmail: expect.any(Array) })
    mockSettingsStore.updateAllocation({ medical_sick: 7, casual: 8, annual: 7 })
    expect(mockAuditStore.list(page).results[0]).toMatchObject({
      entity: 'settings',
      before: { Casual: '7' },
      after: { Casual: '8' },
    })
  })

  it('holidays are not counted as leave days (D-088)', () => {
    hr()
    mockSettingsStore.addHoliday({ date: '2026-12-15', name: 'Company day' })
    setMockViewer({ id: 'u-emp-001', role: 'employee' })
    const input = {
      leaveType: 'casual' as const,
      startDate: '2026-12-14',
      endDate: '2026-12-16',
      reason: 'Family event',
      managerIds: ['u-mgr-001'],
      attachment: null,
    }
    expect(
      apiError(() => mockLeaveStore.submit({ ...input, requestedDays: 3 })).fieldErrors
        .requestedDays?.[0],
    ).toMatch(/2 working days/)
    expect(mockLeaveStore.submit({ ...input, requestedDays: 2 }).requestedDays).toBe(2)
  })

  it('the approval rule applies to new requests', () => {
    hr()
    mockSettingsStore.updateApprovals({ decisionRule: 'all', reviewRequired: true })
    setMockViewer({ id: 'u-emp-001', role: 'employee' })
    const r = mockLeaveStore.submit({
      leaveType: 'casual',
      startDate: '2026-12-14',
      endDate: '2026-12-14',
      requestedDays: 1,
      reason: 'Family event',
      managerIds: ['u-mgr-001'],
      attachment: null,
    })
    expect(r.steps.find((s) => s.kind === 'decision')).toMatchObject({
      mode: 'parallel',
      completion: 'all',
    })
    expect(r.steps.find((s) => s.kind === 'review')?.required).toBe(true)
  })
})

describe('reports scope', () => {
  const f = { from: '2026-10-27', to: '2026-11-25' }
  it('employees get no reports; managers only their scope; HR everyone', () => {
    setMockViewer({ id: 'u-emp-001', role: 'employee' })
    expect(apiError(() => mockReportStore.attendance(f)).status).toBe(403)
    setMockViewer({ id: 'u-mgr-001', role: 'manager' })
    const mine = mockReportStore.attendance(f).byEmployee.map((e) => e.name)
    expect(mine).not.toContain('Kamran Aslam')
    expect(mockReportStore.leave(f).byEmployee.every((e) => e.remaining === null)).toBe(true)
    hr()
    const all = mockReportStore.attendance(f)
    expect(all.byEmployee.map((e) => e.name)).toContain('Kamran Aslam')
    expect(all.summary.lateDays).toBe(all.lateArrivals.length)
    expect(mockReportStore.employees(f).total).toBeGreaterThan(mine.length)
  })
})
