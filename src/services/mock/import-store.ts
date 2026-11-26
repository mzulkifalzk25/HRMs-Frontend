// In-memory import "backend" for mock mode (P7, D-080, D-096). It cannot read Excel files (that
// is the backend's job), so each upload gets FICTIONAL sample rows for its type, built from the
// mock organization so they include new rows, duplicates and errors. Everything else behaves like
// the server: HR only, mapping checks, a dry run that changes nothing, execution only after a dry
// run and only once, duplicates skipped unless "update existing" was chosen, row-level results.
import {
  fileProblem,
  IMPORT_LIMITS,
  mappingProblems,
  UPDATE_ALLOWED,
  type ColumnMapping,
  type ImportType,
} from '@/features/imports/lib/import-definitions'
import { parseRow } from '@/features/imports/lib/row-parsing'
import type {
  ImportJob,
  ImportRun,
  ImportSummary,
  RowResult,
} from '@/features/imports/schemas/import.schema'
import { leaveDays } from '@/features/leave/lib/duration'
import { appDateKey, shiftDateKey, toAppIsoString } from '@/lib/datetime'
import { ApiError } from '@/services/api'
import { LEAVE_TYPE_LABELS, type LeaveType } from '@/types/hr'
import { mockAttendanceStore, type AttendanceStore } from './attendance-store'
import { mockHrStore, type HrStore } from './hr-store'
import { mockLeaveStore, type LeaveStore } from './leave-store'
import { getMockViewer, type MockViewer } from './mock-session'

type StoredJob = ImportJob & { cells: string[][]; rowResults: RowResult[] }
type Planned = { result: RowResult; apply?: () => void }

const err = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) => new ApiError({ status, code, message, fieldErrors })

/** The n-th weekday at or before `date` going back (sample dates for attendance). */
function weekdayBack(date: string, n: number): string {
  let d = date
  let count = 0
  while (true) {
    const day = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (day !== 0 && day !== 6) {
      if (count === n) return d
      count += 1
    }
    d = shiftDateKey(d, -1)
  }
}

export function createImportStore(
  options: {
    hr?: HrStore
    attendance?: AttendanceStore
    leave?: LeaveStore
    now?: () => Date
  } = {},
) {
  const hr = options.hr ?? mockHrStore
  const attendance = options.attendance ?? mockAttendanceStore
  const leave = options.leave ?? mockLeaveStore
  const now = options.now ?? (() => new Date())
  let jobs: StoredJob[] = []
  let counter = 0

  function requireHr(): MockViewer {
    const v = getMockViewer()
    if (!v) throw err(401, 'unauthorized', 'Your session has expired. Please sign in again.')
    if (v.role !== 'hr_admin') throw err(403, 'forbidden', 'You do not have permission to do this.')
    return v
  }

  function find(id: string): StoredJob {
    requireHr()
    const job = jobs.find((j) => j.id === id)
    if (!job) throw err(404, 'not_found', 'The requested item was not found.')
    return job
  }

  const publicJob = ({ cells: _c, rowResults: _r, ...job }: StoredJob): ImportJob => ({
    ...job,
    columns: [...job.columns],
    previewRows: job.previewRows.map((r) => [...r]),
    mapping: job.mapping ? { ...job.mapping } : null,
    summary: job.summary ? { ...job.summary } : null,
  })

  /** Fictional rows per type: new records, duplicates and errors (D-096: sample data). */
  function sample(type: ImportType): { columns: string[]; cells: string[][] } {
    const { employees, departments } = hr.importLookups()
    const active = employees.filter((e) => e.status === 'active' && e.code)
    const code = (i: number) => active[i % active.length]?.code ?? 'FBX-0000'
    const existing = active[3]
    const manager = employees.find((e) => e.id === 'u-mgr-001')
    const today = appDateKey(now())
    const year = today.slice(0, 4)
    switch (type) {
      case 'employees':
        return {
          columns: [
            'First name',
            'Last name',
            'Email',
            'Role',
            'Department',
            'Job title',
            'Joining date',
            'Mobile',
            'Managers',
          ],
          cells: [
            [
              'Areeba',
              'Khan',
              'areeba.khan@formbaxhr.test',
              'Employee',
              'Engineering',
              'Software Engineer',
              shiftDateKey(today, 7),
              '',
              manager?.email ?? '',
            ],
            [
              'Usama',
              'Tariq',
              'usama.tariq@formbaxhr.test',
              'Employee',
              departments.find((d) => d.code === 'DES')?.code ?? 'DES',
              'Product Designer',
              shiftDateKey(today, 14),
              '+92 300 1234567',
              '',
            ],
            [
              existing?.name.split(' ')[0] ?? 'Hamza',
              existing?.name.split(' ')[1] ?? 'Kareem',
              existing?.email ?? '',
              'Employee',
              'Engineering',
              'Senior Software Engineer',
              '2023-01-09',
              '+92 321 7654321',
              '',
            ],
            [
              'Bilal',
              'Ahmed',
              'bilal.ahmed@',
              'Employee',
              'Engineering',
              'Software Engineer',
              shiftDateKey(today, 7),
              '',
              '',
            ],
            [
              'Sara',
              'Javed',
              'sara.javed@formbaxhr.test',
              'Employee',
              'Marketing',
              'Software Engineer',
              shiftDateKey(today, 7),
              '',
              '',
            ],
            [
              'Kashif',
              'Ali',
              'kashif.ali@formbaxhr.test',
              'Team Lead',
              'Engineering',
              'Team Lead',
              '',
              '',
              '',
            ],
            [
              'Areeba',
              'Khan',
              'areeba.khan@formbaxhr.test',
              'Employee',
              'Engineering',
              'Software Engineer',
              shiftDateKey(today, 7),
              '',
              '',
            ],
          ],
        }
      case 'attendance': {
        const old = (n: number) => weekdayBack(shiftDateKey(today, -45), n)
        const recent = weekdayBack(shiftDateKey(today, -1), 0)
        return {
          columns: ['Employee ID', 'Date', 'Time in', 'Time out'],
          cells: [
            [code(4), old(0), '09:02', '18:10'],
            [code(5), old(0), '09:21:30', '17:55'],
            [code(4), old(1), '08:55', ''],
            [code(6), recent, '09:00', '18:00'],
            [code(4), old(2), '18:00', '09:00'],
            ['FBX-9999', old(0), '09:00', '18:00'],
            [code(5), old(1), '', '18:00'],
          ],
        }
      }
      case 'leave_history':
        return {
          columns: ['Employee ID', 'Type', 'From', 'To', 'Notes'],
          cells: [
            [code(4), 'Annual', `${year}-03-02`, `${year}-03-03`, 'Family event'],
            [code(5), 'Sick', `${year}-04-13`, `${year}-04-13`, ''],
            [
              code(4),
              'Casual',
              `${year}-03-03`,
              `${year}-03-03`,
              'Overlaps the row above once imported',
            ],
            [code(6), 'Maternity', `${year}-05-04`, `${year}-05-05`, ''],
            [code(6), 'Annual', `${year}-06-10`, `${year}-06-08`, ''],
            [code(6), 'Annual', `${year}-01-05`, `${year}-01-30`, 'More days than allocated'],
          ],
        }
      case 'leave_balances':
        return {
          columns: ['Employee ID', 'Type', 'Year', 'Allocated days'],
          cells: [
            [code(4), 'Annual', year, '10'],
            [code(5), 'Casual', year, '7'],
            [code(6), 'Medical/Sick', year, '9'],
            [code(4), 'Annual', year, '-2'],
            ['FBX-9999', 'Casual', year, '7'],
          ],
        }
    }
  }

  /** Plans every row against current data; nothing is changed until `apply` runs (D-096). */
  function plan(job: StoredJob, viewer: MockViewer): Planned[] {
    const mapping = job.mapping ?? {}
    const index = new Map(job.columns.map((c, i) => [c, i]))
    const lookups = hr.importLookups()
    const byCode = new Map(
      lookups.employees.filter((e) => e.code).map((e) => [e.code as string, e]),
    )
    const byEmail = new Map(lookups.employees.map((e) => [e.email, e]))
    const seen = new Set<string>()
    const pendingLeave = new Map<string, Array<[string, string]>>()
    const pendingDeduction = new Map<string, number>()

    return job.cells.map((row, i): Planned => {
      const cells: Record<string, string> = {}
      for (const [field, column] of Object.entries(mapping)) {
        const at = column ? index.get(column) : undefined
        cells[field] = at === undefined ? '' : (row[at] ?? '')
      }
      const rowNo = i + 2
      const parsed = parseRow(job.type, cells)
      const firstKey = Object.values(cells).find((v) => v.trim()) ?? `Row ${rowNo}`
      const out = (
        action: RowResult['action'],
        key: string,
        messages: string[],
        changes: RowResult['changes'] = null,
        apply?: () => void,
      ): Planned => ({
        result: { row: rowNo, action, key, messages, changes },
        apply,
      })
      if (!parsed.ok) return out('error', firstKey, parsed.errors)
      const v = parsed.values

      if (job.type === 'employees') {
        const email = v.email as string
        if (seen.has(email))
          return out('skip', email, ['Repeated in this file; only the first row is used.'])
        seen.add(email)
        const department = lookups.departments.find(
          (d) =>
            d.status === 'active' &&
            (d.name.toLowerCase() === String(v.department).toLowerCase() ||
              (d.code ?? '').toLowerCase() === String(v.department).toLowerCase()),
        )
        const designation = lookups.designations.find(
          (d) =>
            d.status === 'active' && d.title.toLowerCase() === String(v.designation).toLowerCase(),
        )
        const errors: string[] = []
        if (!department) errors.push(`Unknown or inactive department “${String(v.department)}”.`)
        if (!designation) errors.push(`Unknown or inactive designation “${String(v.designation)}”.`)
        const managers = (v.managerEmails as string[]).map((m) => byEmail.get(m))
        if (managers.some((m) => !m || m.status !== 'active'))
          errors.push('Every manager email must belong to an active employee.')
        if (errors.length > 0) return out('error', email, errors)
        const existing = byEmail.get(email)
        if (existing) {
          const changes: Record<string, [string, string]> = {}
          if (existing.departmentId !== department?.id)
            changes.Department = [
              lookups.departments.find((d) => d.id === existing.departmentId)?.name ?? '—',
              department?.name ?? '',
            ]
          if (existing.designationId !== designation?.id)
            changes.Designation = [
              lookups.designations.find((d) => d.id === existing.designationId)?.title ?? '—',
              designation?.title ?? '',
            ]
          if ((v.phone ?? null) !== existing.phone && v.phone)
            changes.Phone = [existing.phone ?? '—', String(v.phone)]
          if (Object.keys(changes).length === 0) return out('skip', email, ['Already up to date.'])
          if (!job.updateExisting)
            return out(
              'skip',
              email,
              [
                'An employee with this email exists. Not changed (choose “update existing records” to change it).',
              ],
              changes,
            )
          return out('update', email, [`Updates ${existing.name}.`], changes, () => {
            hr.updateEmployee(existing.id, {
              departmentId: department?.id,
              designationId: designation?.id,
              ...(v.phone ? { phone: String(v.phone) } : {}),
            })
          })
        }
        return out(
          'create',
          email,
          ['New employee; an invitation is sent (mock: none).'],
          null,
          () => {
            hr.createEmployee({
              firstName: String(v.firstName),
              lastName: String(v.lastName),
              email,
              phone: (v.phone as string | null) ?? null,
              role: v.role as never,
              departmentId: department?.id ?? '',
              designationId: designation?.id ?? '',
              joiningDate: String(v.joiningDate),
              managerIds: managers.map((m) => m?.id ?? ''),
              teamIds: [],
              projectIds: [],
            })
          },
        )
      }

      const person = byCode.get(String(v.employeeCode))
      if (!person)
        return out('error', String(v.employeeCode), [
          `No employee with code ${String(v.employeeCode)}.`,
        ])
      const leaveType = v.leaveType as LeaveType

      if (job.type === 'attendance') {
        const key = `${person.code} · ${String(v.date)}`
        if ((v.date as string) >= appDateKey(now()))
          return out('error', key, ['Only past days can be imported.'])
        if (seen.has(key))
          return out('skip', key, ['Repeated in this file; only the first row is used.'])
        seen.add(key)
        if (attendance.hasRecord(person.id, String(v.date)))
          return out('skip', key, ['A record already exists for this day. Not changed.'])
        return out(
          'create',
          key,
          [
            `${person.name}: ${String(v.checkIn)}–${v.checkOut ? String(v.checkOut) : 'no check-out'} (Pakistan time).`,
          ],
          null,
          () => {
            attendance.importDay({
              employeeId: person.id,
              date: String(v.date),
              checkIn: String(v.checkIn),
              checkOut: (v.checkOut as string | null) ?? null,
            })
          },
        )
      }

      if (job.type === 'leave_history') {
        const start = String(v.startDate)
        const end = String(v.endDate)
        const key = `${person.code} · ${start}–${end}`
        const days = leaveDays(start, end)
        if (days === 0) return out('error', key, ['These dates contain no working days.'])
        const inFile = pendingLeave.get(person.id) ?? []
        if (
          leave.hasOverlap(person.id, start, end) ||
          inFile.some(([s, e]) => s <= end && start <= e)
        )
          return out('skip', key, ['Overlaps existing leave. Not imported.'])
        const balanceKey = `${person.id}|${leaveType}|${start.slice(0, 4)}`
        const used = pendingDeduction.get(balanceKey) ?? 0
        const remaining =
          leave.balanceFor(person.id, leaveType, Number(start.slice(0, 4))).remaining - used
        if (days > remaining)
          return out('error', key, [
            `Needs ${days} ${LEAVE_TYPE_LABELS[leaveType]} days; only ${remaining} remain.`,
          ])
        inFile.push([start, end])
        pendingLeave.set(person.id, inFile)
        pendingDeduction.set(balanceKey, used + days)
        return out(
          'create',
          key,
          [
            `${person.name}: ${LEAVE_TYPE_LABELS[leaveType]}, ${days} working days, approved, deducted.`,
          ],
          null,
          () => {
            leave.importHistory({
              employeeId: person.id,
              leaveType,
              startDate: start,
              endDate: end,
              reason: String(v.reason),
              actorId: viewer.id,
            })
          },
        )
      }

      // leave_balances
      const year = Number(v.year)
      const key = `${person.code} · ${LEAVE_TYPE_LABELS[leaveType]} ${year}`
      if (seen.has(key))
        return out('skip', key, ['Repeated in this file; only the first row is used.'])
      seen.add(key)
      const current = leave.balanceFor(person.id, leaveType, year)
      const allocated = Number(v.allocated)
      if (current.allocated === allocated) return out('skip', key, ['Already this value.'])
      if (allocated < current.used)
        return out('error', key, [
          `${current.used} days are already used; the allocation cannot be lower.`,
        ])
      const changes = {
        Allocated: [String(current.allocated), String(allocated)] as [string, string],
      }
      if (!job.updateExisting)
        return out(
          'skip',
          key,
          ['Changes an existing balance. Not changed (choose “update existing records”).'],
          changes,
        )
      return out(
        'update',
        key,
        [`${person.name}: allocation ${current.allocated} → ${allocated}.`],
        changes,
        () => {
          leave.importBalance({
            employeeId: person.id,
            leaveType,
            year,
            allocated,
            actorId: viewer.id,
          })
        },
      )
    })
  }

  const summarize = (rows: RowResult[]): ImportSummary => ({
    create: rows.filter((r) => r.action === 'create').length,
    update: rows.filter((r) => r.action === 'update').length,
    skip: rows.filter((r) => r.action === 'skip').length,
    error: rows.filter((r) => r.action === 'error').length,
  })

  return {
    reset() {
      jobs = []
      counter = 0
    },

    create(type: ImportType, file: { name: string; size: number }): ImportJob {
      const v = requireHr()
      const problem = fileProblem(file)
      if (problem) throw err(400, 'validation_error', problem, { file: [problem] })
      const { columns, cells } = sample(type)
      if (cells.length > IMPORT_LIMITS.maxRows)
        throw err(400, 'validation_error', 'Too many rows.', {
          file: ['At most 5,000 rows per file.'],
        })
      counter += 1
      const job: StoredJob = {
        id: `imp-${counter}`,
        type,
        fileName: file.name,
        fileSize: file.size,
        status: 'uploaded',
        createdAt: toAppIsoString(now()),
        createdByName: hr.leaveOrg().people.find((p) => p.id === v.id)?.name ?? 'HR',
        columns,
        previewRows: cells.slice(0, IMPORT_LIMITS.previewRows),
        totalRows: cells.length,
        sampleData: true,
        mapping: null,
        updateExisting: false,
        summary: null,
        executedAt: null,
        cells,
        rowResults: [],
      }
      jobs.push(job)
      return publicJob(job)
    },

    list(): ImportJob[] {
      requireHr()
      return [...jobs]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .map(publicJob)
    },

    get: (id: string) => publicJob(find(id)),
    rows: (id: string) => find(id).rowResults.map((r) => ({ ...r, messages: [...r.messages] })),

    dryRun(id: string, input: { mapping: ColumnMapping; updateExisting: boolean }): ImportRun {
      const job = find(id)
      const viewer = requireHr()
      if (job.status === 'completed')
        throw err(409, 'already_executed', 'This import has already been run.')
      const problems = mappingProblems(job.type, input.mapping)
      if (Object.keys(problems).length > 0)
        throw err(
          400,
          'validation_error',
          'Fix the column mapping.',
          Object.fromEntries(Object.entries(problems).map(([k, m]) => [k, [m]])),
        )
      if (input.updateExisting && !UPDATE_ALLOWED[job.type])
        throw err(
          400,
          'validation_error',
          'Existing records cannot be updated by this import type.',
        )
      job.mapping = { ...input.mapping }
      job.updateExisting = input.updateExisting
      job.rowResults = plan(job, viewer).map((p) => p.result) // nothing applied
      job.summary = summarize(job.rowResults)
      job.status = 'validated'
      return { job: publicJob(job), rows: job.rowResults }
    },

    execute(id: string): ImportRun {
      const job = find(id)
      const viewer = requireHr()
      if (job.status === 'completed')
        throw err(409, 'already_executed', 'This import has already been run.')
      if (job.status !== 'validated')
        throw err(409, 'dry_run_required', 'Run a dry run before importing.')
      // Re-plan against the current data (it may have changed since the dry run), then apply.
      const results = plan(job, viewer).map((p) => {
        if (!p.apply) return p.result
        try {
          p.apply()
          return p.result
        } catch (error) {
          const message = error instanceof ApiError ? error.message : 'Could not be imported.'
          const fields = error instanceof ApiError ? Object.values(error.fieldErrors).flat() : []
          return { ...p.result, action: 'error' as const, messages: [message, ...fields] }
        }
      })
      job.rowResults = results
      job.summary = summarize(results)
      job.status =
        job.summary.create + job.summary.update === 0 && job.summary.error > 0
          ? 'failed'
          : 'completed'
      job.executedAt = toAppIsoString(now())
      return { job: publicJob(job), rows: job.rowResults }
    },
  }
}

export type ImportStore = ReturnType<typeof createImportStore>

/** The shared mock store used by the registry. Tests reset it between cases. */
export const mockImportStore = createImportStore()
