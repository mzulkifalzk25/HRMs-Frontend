// In-memory attendance "backend" for mock mode (P4-T03, D-080). FICTIONAL data. It applies the
// same pure policy as the UI (features/attendance/lib/policy.ts) in Asia/Karachi, like the Django
// backend will (D-028), and behaves like a server: single session per day (provisional Q-ATT-03),
// 409 on duplicate check-in/out, HR-only corrections with a mandatory reason and audit entries,
// scoping identical to the employee directory, 404 outside the scope.
import {
  attendanceDate,
  classifyCheckIn,
  classifyCheckOut,
  workingDurationMs,
} from '@/features/attendance/lib/policy'
import type {
  AttendanceListQuery,
  AttendanceRecord,
  AttendanceSummary,
  CorrectionEntry,
  CorrectionInput,
  TodayAttendance,
} from '@/features/attendance/schemas/attendance.schema'
import { CORRECTION_REASON_MIN_LENGTH } from '@/features/attendance/schemas/attendance.schema'
import {
  appDateKey,
  appWallClockToInstant,
  shiftDateKey,
  toAppIsoString,
  toAppZone,
} from '@/lib/datetime'
import { ApiError } from '@/services/api'
import type { Page } from '@/types/api'
import { mockHrStore, type HrStore } from './hr-store'
import { mockLeaveStore } from './leave-store'
import { getMockViewer } from './mock-session'

const HISTORY_DAYS = 30
/** Demo login accounts start each day not checked in, so the check-in flow can be tried. */
const DEMO_ACCOUNT = /^u-/

/** Deterministic 0..1 value per (seed text) — stable mock data without Math.random. */
function hash01(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10_000) / 10_000
}

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (minutes: number, seconds = 0) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(seconds)}`

const err = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) => new ApiError({ status, code, message, fieldErrors })

/** Approved leave lookup (the leave backend), used for the "on leave" count. */
type LeaveLookup = { isOnLeave(employeeId: string, date: string): boolean }

export function createAttendanceStore(
  options: { hr?: HrStore; now?: () => Date; leave?: LeaveLookup } = {},
) {
  const hr = options.hr ?? mockHrStore
  const leave = options.leave ?? mockLeaveStore
  const now = options.now ?? (() => new Date())
  let records = new Map<string, AttendanceRecord>()
  let corrections: CorrectionEntry[] = []
  let counter = 0

  function build(
    person: { id: string; name: string; departmentName: string | null },
    date: string,
    checkInAt: string | null,
    checkOutAt: string | null,
    corrected = false,
  ): AttendanceRecord {
    return {
      id: `att-${person.id}-${date}`,
      employeeId: person.id,
      employeeName: person.name,
      departmentName: person.departmentName,
      date,
      checkInAt,
      checkOutAt,
      checkInStatus: checkInAt ? classifyCheckIn(checkInAt) : null,
      checkOutStatus: checkOutAt ? classifyCheckOut(checkOutAt) : null,
      durationMs: workingDurationMs(checkInAt, checkOutAt),
      corrected,
    }
  }

  function seed() {
    records = new Map()
    corrections = []
    counter = 0
    const today = appDateKey(now())
    const nowMs = now().getTime()
    const people = hr.attendancePeople()
    for (let offset = HISTORY_DAYS; offset >= 0; offset -= 1) {
      const date = shiftDateKey(today, -offset)
      // Mock data only covers Monday–Friday. This is sample data, not a weekend rule (Q-ATT-05).
      const weekday = toAppZone(appWallClockToInstant(date, '12:00')).getDay()
      if (weekday === 0 || weekday === 6) continue
      for (const person of people) {
        if (person.status === 'invited' || person.joiningDate > date) continue
        if (person.status === 'inactive' && offset < 10) continue
        if (offset === 0 && DEMO_ACCOUNT.test(person.id)) continue
        const r = hash01(`${person.id}|${date}`)
        if (r < 0.07) continue // no record that day (definition of absent is open, Q-ATT-02)
        const inMinutes = 8 * 60 + 35 + Math.floor(hash01(`${person.id}|${date}|in`) * 60) // 08:35–09:34
        const checkIn = appWallClockToInstant(date, clock(inMinutes, Math.floor(r * 59)))
        if (checkIn.getTime() > nowMs) continue
        const outMinutes = 17 * 60 + 30 + Math.floor(hash01(`${person.id}|${date}|out`) * 90) // 17:30–18:59
        const checkOut = appWallClockToInstant(date, clock(outMinutes, Math.floor(r * 47)))
        const forgot = offset > 0 && r > 0.96 // forgotten checkout → incomplete (Q-ATT-06)
        const closed = !forgot && checkOut.getTime() <= nowMs
        const record = build(
          person,
          date,
          toAppIsoString(checkIn),
          closed ? toAppIsoString(checkOut) : null,
        )
        records.set(record.id, record)
      }
    }
  }
  seed()

  function viewer() {
    const v = getMockViewer()
    if (!v) throw err(401, 'unauthorized', 'Your session has expired. Please sign in again.')
    return v
  }
  const personOf = (id: string) => hr.attendancePeople().find((p) => p.id === id)
  const canSee = (recordEmployeeId: string) => {
    const v = viewer()
    if (v.id === recordEmployeeId) return true
    const scope = hr.visibleEmployeeIds()
    return scope === null || scope.has(recordEmployeeId)
  }
  const todayKey = () => appDateKey(now())

  function todayRecord(employeeId: string): AttendanceRecord | null {
    return records.get(`att-${employeeId}-${todayKey()}`) ?? null
  }

  return {
    reset: seed,

    today(): TodayAttendance {
      const v = viewer()
      return { date: todayKey(), record: todayRecord(v.id) }
    },

    checkIn(): AttendanceRecord {
      const v = viewer()
      const person = personOf(v.id)
      if (!person) throw err(404, 'not_found', 'Your employee record was not found.')
      if (todayRecord(v.id))
        throw err(409, 'already_checked_in', 'You have already checked in today.')
      const at = now()
      const record = build(person, attendanceDate(at), toAppIsoString(at), null)
      records.set(record.id, record)
      return record
    },

    checkOut(): AttendanceRecord {
      const v = viewer()
      const current = todayRecord(v.id)
      if (!current?.checkInAt) throw err(400, 'not_checked_in', 'Check in before checking out.')
      if (current.checkOutAt)
        throw err(409, 'already_checked_out', 'You have already checked out today.')
      const person = personOf(v.id)
      if (!person) throw err(404, 'not_found', 'Your employee record was not found.')
      const record = build(
        person,
        current.date,
        current.checkInAt,
        toAppIsoString(now()),
        current.corrected,
      )
      records.set(record.id, record)
      return record
    },

    mine(from: string, to: string): AttendanceRecord[] {
      const v = viewer()
      return [...records.values()]
        .filter((r) => r.employeeId === v.id && r.date >= from && r.date <= to)
        .sort((a, b) => b.date.localeCompare(a.date))
    },

    list(query: AttendanceListQuery): Page<AttendanceRecord> {
      const v = viewer()
      if (v.role === 'employee')
        throw err(403, 'forbidden', 'You do not have permission to do this.')
      const scope = hr.visibleEmployeeIds()
      const people = new Map(hr.attendancePeople().map((p) => [p.id, p]))
      const today = todayKey()
      let rows = [...records.values()].filter(
        (r) =>
          (scope === null || scope.has(r.employeeId)) && r.date >= query.from && r.date <= query.to,
      )
      if (query.employeeId) rows = rows.filter((r) => r.employeeId === query.employeeId)
      if (query.departmentId)
        rows = rows.filter((r) => people.get(r.employeeId)?.departmentId === query.departmentId)
      if (query.teamId)
        rows = rows.filter((r) =>
          people.get(r.employeeId)?.teamIds.includes(query.teamId as string),
        )
      if (query.filter === 'late') rows = rows.filter((r) => r.checkInStatus === 'late')
      if (query.filter === 'incomplete')
        rows = rows.filter((r) => r.checkInAt && !r.checkOutAt && r.date < today)
      if (query.filter === 'corrected') rows = rows.filter((r) => r.corrected)
      rows.sort(
        (a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName),
      )
      const start = (query.page - 1) * query.pageSize
      return {
        count: rows.length,
        next: start + query.pageSize < rows.length ? `?page=${query.page + 1}` : null,
        previous: query.page > 1 ? `?page=${query.page - 1}` : null,
        results: rows.slice(start, start + query.pageSize),
      }
    },

    get(id: string): AttendanceRecord {
      const record = records.get(id)
      if (!record || !canSee(record.employeeId))
        throw err(404, 'not_found', 'The requested item was not found.')
      return record
    },

    correct(id: string, input: CorrectionInput): AttendanceRecord {
      const v = viewer()
      if (v.role !== 'hr_admin')
        throw err(403, 'forbidden', 'You do not have permission to do this.')
      const current = records.get(id)
      if (!current) throw err(404, 'not_found', 'The requested item was not found.')
      const errors: Record<string, string[]> = {}
      if (input.reason.trim().length < CORRECTION_REASON_MIN_LENGTH)
        errors.reason = ['Give a reason for this correction.']
      if (!input.checkInAt && input.checkOutAt)
        errors.checkInAt = ['A check-out needs a check-in time.']
      for (const [field, value] of [
        ['checkInAt', input.checkInAt],
        ['checkOutAt', input.checkOutAt],
      ] as const) {
        if (value && attendanceDate(value) !== current.date)
          errors[field] = ['The time must be on the same day as the record.']
      }
      if (
        input.checkInAt &&
        input.checkOutAt &&
        new Date(input.checkOutAt) <= new Date(input.checkInAt)
      ) {
        errors.checkOutAt = ['Check-out must be after check-in.']
      }
      if (Object.keys(errors).length > 0)
        throw err(400, 'validation_error', 'Some fields are not valid.', errors)
      const person = personOf(current.employeeId)
      const actor = personOf(v.id)
      if (!person) throw err(404, 'not_found', 'The requested item was not found.')
      const updated = build(person, current.date, input.checkInAt, input.checkOutAt, true)
      records.set(id, updated)
      counter += 1
      corrections.unshift({
        id: `cor-${counter}`,
        recordId: id,
        actorName: actor?.name ?? 'HR',
        at: toAppIsoString(now()),
        reason: input.reason.trim(),
        before: { checkInAt: current.checkInAt, checkOutAt: current.checkOutAt },
        after: { checkInAt: updated.checkInAt, checkOutAt: updated.checkOutAt },
      })
      return updated
    },

    /** Visible to anyone who may see the record (provisional; audit visibility is Q-AUD-01). */
    corrections(recordId: string): CorrectionEntry[] {
      this.get(recordId)
      return corrections.filter((c) => c.recordId === recordId)
    },

    summary(): AttendanceSummary {
      const v = viewer()
      const scope = v.role === 'employee' ? new Set([v.id]) : hr.visibleEmployeeIds()
      const today = todayKey()
      const people = hr
        .attendancePeople()
        .filter((p) => p.status === 'active' && (scope === null || scope.has(p.id)))
      const todays = people
        .map((p) => records.get(`att-${p.id}-${today}`))
        .filter((r) => r !== undefined)
      const incomplete = [...records.values()].filter(
        (r) =>
          r.checkInAt &&
          !r.checkOutAt &&
          r.date < today &&
          people.some((p) => p.id === r.employeeId),
      ).length
      const checkedIn = new Set(todays.map((r) => r.employeeId))
      const onLeave = people.filter((p) => !checkedIn.has(p.id) && leave.isOnLeave(p.id, today))
      return {
        date: today,
        total: people.length,
        present: todays.length,
        late: todays.filter((r) => r.checkInStatus === 'late').length,
        onLeave: onLeave.length, // approved leave today, not checked in
        notCheckedIn: people.length - todays.length - onLeave.length,
        absent: 0, // provisional: the definition of absent is open (Q-ATT-02)
        incomplete,
      }
    },
  }
}

export type AttendanceStore = ReturnType<typeof createAttendanceStore>

export const mockAttendanceStore = createAttendanceStore()
