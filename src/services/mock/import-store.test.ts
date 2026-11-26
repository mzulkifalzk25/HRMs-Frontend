// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { suggestMapping, type ImportType } from '@/features/imports/lib/import-definitions'
import { importJobSchema, rowResultSchema } from '@/features/imports/schemas/import.schema'
import type { ApiError } from '@/services/api'
import { createAttendanceStore } from './attendance-store'
import { createHrStore } from './hr-store'
import { createImportStore, type ImportStore } from './import-store'
import { createLeaveStore } from './leave-store'
import { setMockViewer } from './mock-session'
import { createNotificationStore } from './notification-store'

const now = () => new Date('2026-11-25T06:00:00Z')
let store: ImportStore
let hr: ReturnType<typeof createHrStore>
let leave: ReturnType<typeof createLeaveStore>
let attendance: ReturnType<typeof createAttendanceStore>
beforeEach(() => {
  hr = createHrStore()
  leave = createLeaveStore({ hr, now, notifications: createNotificationStore({ hr, now }) })
  setMockViewer({ id: 'u-hr-001', role: 'hr_admin' })
  attendance = createAttendanceStore({ hr, now, leave })
  store = createImportStore({ hr, leave, attendance, now })
})

function apiError(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (error) {
    return error as ApiError
  }
  throw new Error('Expected an ApiError')
}

function upload(type: ImportType) {
  const job = store.create(type, { name: 'data.xlsx', size: 2048 })
  return { job, mapping: suggestMapping(type, job.columns) }
}

describe('import jobs (P7)', () => {
  it('only HR can import; uploads are checked', () => {
    setMockViewer({ id: 'u-mgr-001', role: 'manager' })
    expect(apiError(() => store.create('employees', { name: 'a.xlsx', size: 10 })).status).toBe(403)
    setMockViewer({ id: 'u-hr-001', role: 'hr_admin' })
    expect(
      apiError(() => store.create('employees', { name: 'a.csv', size: 10 })).fieldErrors.file,
    ).toEqual(['Choose an Excel file (.xlsx or .xls).'])
    const { job } = upload('employees')
    importJobSchema.parse(job)
    expect(job).toMatchObject({ status: 'uploaded', sampleData: true, totalRows: 7 })
  })

  it('dry run changes nothing; execute needs a dry run and runs once', () => {
    const { job, mapping } = upload('employees')
    expect(apiError(() => store.execute(job.id)).code).toBe('dry_run_required')
    const before = hr.importLookups().employees.length
    const run = store.dryRun(job.id, { mapping, updateExisting: false })
    run.rows.forEach((r) => rowResultSchema.parse(r))
    expect(run.job.summary).toEqual({ create: 2, update: 0, skip: 2, error: 3 })
    expect(hr.importLookups().employees.length).toBe(before) // nothing created
    const done = store.execute(job.id)
    expect(done.job.status).toBe('completed')
    expect(hr.importLookups().employees.length).toBe(before + 2)
    expect(apiError(() => store.execute(job.id)).code).toBe('already_executed')
  })

  it('never overwrites silently: existing employees change only when chosen', () => {
    const { job, mapping } = upload('employees')
    const skip = store
      .dryRun(job.id, { mapping, updateExisting: false })
      .rows.find((r) => r.row === 4)
    expect(skip).toMatchObject({ action: 'skip', changes: { Phone: expect.any(Array) } })
    const update = store
      .dryRun(job.id, { mapping, updateExisting: true })
      .rows.find((r) => r.row === 4)
    expect(update?.action).toBe('update')
    store.execute(job.id)
    const after = hr.importLookups().employees.find((e) => e.email === update?.key)
    expect(after?.phone).toBe('+92 321 7654321')
  })

  it('rejects a mapping with missing required fields', () => {
    const { job } = upload('attendance')
    const error = apiError(() =>
      store.dryRun(job.id, {
        mapping: { employeeCode: 'Employee ID', date: null, checkIn: null, checkOut: null },
        updateExisting: false,
      }),
    )
    expect(Object.keys(error.fieldErrors)).toEqual(['date', 'checkIn'])
  })

  it('attendance: new past days are created, existing days skipped, errors reported', () => {
    const { job, mapping } = upload('attendance')
    const run = store.dryRun(job.id, { mapping, updateExisting: false })
    expect(run.rows.map((r) => r.action)).toEqual([
      'create',
      'create',
      'create',
      'skip',
      'error',
      'error',
      'error',
    ])
    store.execute(job.id)
    const created = run.rows[0]?.key.split(' · ') ?? []
    const employee = hr.importLookups().employees.find((e) => e.code === created[0])
    expect(attendance.hasRecord(employee?.id ?? '', created[1] ?? '')).toBe(true)
  })

  it('historical leave becomes approved leave with a deduction; overlaps and overdraws refused', () => {
    const { job, mapping } = upload('leave_history')
    const run = store.dryRun(job.id, { mapping, updateExisting: false })
    expect(run.rows.map((r) => r.action)).toEqual([
      'create',
      'create',
      'skip',
      'error',
      'error',
      'error',
    ])
    store.execute(job.id)
    const code = run.rows[0]?.key.split(' · ')[0]
    const employee = hr.importLookups().employees.find((e) => e.code === code)
    expect(leave.balanceFor(employee?.id ?? '', 'annual', 2026).used).toBe(2)
  })

  it('leave balances change only with "update existing" and go through the ledger', () => {
    const { job, mapping } = upload('leave_balances')
    expect(
      store.dryRun(job.id, { mapping, updateExisting: false }).rows.map((r) => r.action),
    ).toEqual(['skip', 'skip', 'skip', 'error', 'error'])
    const run = store.dryRun(job.id, { mapping, updateExisting: true })
    expect(run.rows.map((r) => r.action)).toEqual(['update', 'skip', 'update', 'error', 'error'])
    store.execute(job.id)
    const code = run.rows[0]?.key.split(' · ')[0]
    const employee = hr.importLookups().employees.find((e) => e.code === code)
    expect(leave.balanceFor(employee?.id ?? '', 'annual', 2026).allocated).toBe(10)
    expect(store.list().map((j) => j.status)).toEqual(['completed'])
  })
})
