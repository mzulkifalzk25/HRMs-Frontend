// Import types, their fields, file limits and mapping checks (P7-T01, T03, T05; D-071, D-096).
// Pure. The backend is authoritative and re-validates everything.

export const IMPORT_TYPES = ['employees', 'attendance', 'leave_history', 'leave_balances'] as const
export type ImportType = (typeof IMPORT_TYPES)[number]

export const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  employees: 'Employees',
  attendance: 'Historical attendance',
  leave_history: 'Historical leave',
  leave_balances: 'Leave balances',
}

export type ImportField = {
  key: string
  label: string
  required: boolean
  /** Shown under the mapping: expected format. */
  hint?: string
  /** Other header spellings recognised for the suggested mapping. */
  aliases?: string[]
}

const code: ImportField = {
  key: 'employeeCode',
  label: 'Employee code',
  required: true,
  hint: 'e.g. FBX-1009',
  aliases: ['employee id', 'emp code', 'code'],
}
const leaveType: ImportField = {
  key: 'leaveType',
  label: 'Leave type',
  required: true,
  hint: 'Medical/Sick, Casual or Annual',
  aliases: ['type'],
}

export const IMPORT_FIELDS: Record<ImportType, ImportField[]> = {
  employees: [
    { key: 'firstName', label: 'First name', required: true, aliases: ['first'] },
    { key: 'lastName', label: 'Last name', required: true, aliases: ['last', 'surname'] },
    {
      key: 'email',
      label: 'Work email',
      required: true,
      hint: 'Used to find existing employees',
      aliases: ['email', 'e-mail'],
    },
    { key: 'role', label: 'Role', required: true, hint: 'e.g. Employee, Team Lead, Manager' },
    { key: 'department', label: 'Department', required: true, hint: 'Name or code' },
    { key: 'designation', label: 'Designation', required: true, aliases: ['title', 'job title'] },
    {
      key: 'joiningDate',
      label: 'Joining date',
      required: true,
      hint: 'YYYY-MM-DD',
      aliases: ['joined', 'start date'],
    },
    { key: 'phone', label: 'Phone', required: false, aliases: ['mobile'] },
    {
      key: 'managerEmails',
      label: 'Manager emails',
      required: false,
      hint: 'Separate several with ;',
      aliases: ['managers', 'manager'],
    },
  ],
  attendance: [
    code,
    { key: 'date', label: 'Date', required: true, hint: 'YYYY-MM-DD' },
    {
      key: 'checkIn',
      label: 'Check-in',
      required: true,
      hint: 'HH:MM or HH:MM:SS, Pakistan time',
      aliases: ['in', 'time in'],
    },
    {
      key: 'checkOut',
      label: 'Check-out',
      required: false,
      hint: 'HH:MM or HH:MM:SS, Pakistan time',
      aliases: ['out', 'time out'],
    },
  ],
  leave_history: [
    code,
    leaveType,
    {
      key: 'startDate',
      label: 'Start date',
      required: true,
      hint: 'YYYY-MM-DD',
      aliases: ['from'],
    },
    { key: 'endDate', label: 'End date', required: true, hint: 'YYYY-MM-DD', aliases: ['to'] },
    { key: 'reason', label: 'Reason', required: false, aliases: ['notes'] },
  ],
  leave_balances: [
    code,
    leaveType,
    { key: 'year', label: 'Leave year', required: true, hint: 'e.g. 2026' },
    {
      key: 'allocated',
      label: 'Allocated days',
      required: true,
      hint: 'Whole days',
      aliases: ['allocation', 'days'],
    },
  ],
}

/** Whether "update existing records" can be chosen for this type (D-096). */
export const UPDATE_ALLOWED: Record<ImportType, boolean> = {
  employees: true,
  attendance: false,
  leave_history: false,
  leave_balances: true,
}

export const IMPORT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 5000,
  extensions: ['.xlsx', '.xls'] as readonly string[],
  previewRows: 10,
}

/** Upload check for UX; the backend checks again (content, not just the name). */
export function fileProblem(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase()
  if (!IMPORT_LIMITS.extensions.some((ext) => name.endsWith(ext)))
    return 'Choose an Excel file (.xlsx or .xls).'
  if (file.size === 0) return 'The file is empty.'
  if (file.size > IMPORT_LIMITS.maxBytes) return 'The file is larger than 10 MB.'
  return null
}

export type ColumnMapping = Record<string, string | null>

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Suggested mapping: a column whose header matches the field label, key or an alias. */
export function suggestMapping(type: ImportType, columns: readonly string[]): ColumnMapping {
  const used = new Set<string>()
  const mapping: ColumnMapping = {}
  for (const field of IMPORT_FIELDS[type]) {
    const names = [field.label, field.key, ...(field.aliases ?? [])].map(normalize)
    const match = columns.find((c) => !used.has(c) && names.includes(normalize(c)))
    mapping[field.key] = match ?? null
    if (match) used.add(match)
  }
  return mapping
}

/** Required fields must be mapped and a column may feed only one field. */
export function mappingProblems(type: ImportType, mapping: ColumnMapping): Record<string, string> {
  const problems: Record<string, string> = {}
  const seen = new Map<string, string>()
  for (const field of IMPORT_FIELDS[type]) {
    const column = mapping[field.key] ?? null
    if (!column) {
      if (field.required) problems[field.key] = 'Required: choose a column.'
      continue
    }
    const other = seen.get(column)
    if (other) problems[field.key] = `“${column}” is already used for ${other}.`
    else seen.set(column, field.label)
  }
  return problems
}
