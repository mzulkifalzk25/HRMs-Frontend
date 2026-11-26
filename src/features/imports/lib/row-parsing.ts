// Row parsing per import type (P7-T06, P7-T12; D-096). Pure: turns mapped text cells into typed
// values or row errors. Lookups against existing data (duplicates, unknown employees) happen in
// the backend (mock: services/mock/import-store.ts).
import { LEAVE_TYPE_LABELS, LEAVE_TYPES, type LeaveType } from '@/types/hr'
import { ROLE_LABELS, ROLES, type Role } from '@/features/authentication/types'
import type { ImportType } from './import-definitions'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const norm = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')

export function parseLeaveType(value: string): LeaveType | null {
  const n = norm(value)
  if (n === 'sick' || n === 'medical') return 'medical_sick'
  return LEAVE_TYPES.find((t) => norm(t) === n || norm(LEAVE_TYPE_LABELS[t]) === n) ?? null
}

export function parseRole(value: string): Role | null {
  const n = norm(value)
  return ROLES.find((r) => norm(r) === n || norm(ROLE_LABELS[r]) === n) ?? null
}

export type ParsedRow =
  | { ok: true; values: Record<string, string | number | string[] | null> }
  | { ok: false; errors: string[] }

type Cells = Record<string, string>

function need(cells: Cells, key: string, label: string, errors: string[]): string {
  const v = (cells[key] ?? '').trim()
  if (!v) errors.push(`${label} is missing.`)
  return v
}

export function parseRow(type: ImportType, cells: Cells): ParsedRow {
  const errors: string[] = []
  const opt = (key: string) => (cells[key] ?? '').trim()
  let values: Record<string, string | number | string[] | null> = {}
  switch (type) {
    case 'employees': {
      const email = need(cells, 'email', 'Work email', errors).toLowerCase()
      if (email && !EMAIL.test(email)) errors.push(`“${email}” is not a valid email.`)
      const roleText = need(cells, 'role', 'Role', errors)
      const role = roleText ? parseRole(roleText) : null
      if (roleText && !role) errors.push(`Unknown role “${roleText}”.`)
      const joiningDate = need(cells, 'joiningDate', 'Joining date', errors)
      if (joiningDate && !isValidDate(joiningDate)) errors.push('Joining date must be YYYY-MM-DD.')
      values = {
        firstName: need(cells, 'firstName', 'First name', errors),
        lastName: need(cells, 'lastName', 'Last name', errors),
        email,
        role,
        department: need(cells, 'department', 'Department', errors),
        designation: need(cells, 'designation', 'Designation', errors),
        joiningDate,
        phone: opt('phone') || null,
        managerEmails: opt('managerEmails')
          .split(';')
          .map((m) => m.trim().toLowerCase())
          .filter(Boolean),
      }
      break
    }
    case 'attendance': {
      const date = need(cells, 'date', 'Date', errors)
      if (date && !isValidDate(date)) errors.push('Date must be YYYY-MM-DD.')
      const checkIn = need(cells, 'checkIn', 'Check-in', errors)
      if (checkIn && !TIME.test(checkIn)) errors.push('Check-in must be HH:MM or HH:MM:SS.')
      const checkOut = opt('checkOut')
      if (checkOut && !TIME.test(checkOut)) errors.push('Check-out must be HH:MM or HH:MM:SS.')
      const sec = (t: string) => (t.length === 5 ? `${t}:00` : t)
      if (
        checkIn &&
        checkOut &&
        TIME.test(checkIn) &&
        TIME.test(checkOut) &&
        sec(checkOut) <= sec(checkIn)
      )
        errors.push('Check-out must be after check-in.')
      values = {
        employeeCode: need(cells, 'employeeCode', 'Employee code', errors).toUpperCase(),
        date,
        checkIn: checkIn ? sec(checkIn) : null,
        checkOut: checkOut ? sec(checkOut) : null,
      }
      break
    }
    case 'leave_history':
    case 'leave_balances': {
      const typeText = need(cells, 'leaveType', 'Leave type', errors)
      const leaveType = typeText ? parseLeaveType(typeText) : null
      if (typeText && !leaveType) errors.push(`Unknown leave type “${typeText}”.`)
      values = {
        employeeCode: need(cells, 'employeeCode', 'Employee code', errors).toUpperCase(),
        leaveType,
      }
      if (type === 'leave_history') {
        const startDate = need(cells, 'startDate', 'Start date', errors)
        const endDate = need(cells, 'endDate', 'End date', errors)
        const okDates = isValidDate(startDate) && isValidDate(endDate)
        if ((startDate || endDate) && !okDates) errors.push('Dates must be YYYY-MM-DD.')
        else if (okDates && endDate < startDate) errors.push('End date is before the start date.')
        else if (okDates && startDate.slice(0, 4) !== endDate.slice(0, 4))
          errors.push('Leave must stay within one leave year.')
        values = { ...values, startDate, endDate, reason: opt('reason') || 'Imported leave record' }
      } else {
        const year = Number(need(cells, 'year', 'Leave year', errors))
        const allocated = Number(need(cells, 'allocated', 'Allocated days', errors))
        if (!Number.isInteger(year) || year < 2000 || year > 2100)
          errors.push('Leave year must be a year such as 2026.')
        if (!Number.isInteger(allocated) || allocated < 0 || allocated > 365)
          errors.push('Allocated days must be a whole number from 0 to 365.')
        values = { ...values, year, allocated }
      }
      break
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, values }
}
