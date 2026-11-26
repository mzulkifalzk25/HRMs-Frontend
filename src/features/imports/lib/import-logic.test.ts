import { describe, expect, it } from 'vitest'
import { fileProblem, mappingProblems, suggestMapping } from './import-definitions'
import { parseRow } from './row-parsing'

describe('upload checks (D-096)', () => {
  it.each([
    [{ name: 'staff.xlsx', size: 1000 }, null],
    [{ name: 'OLD.XLS', size: 1000 }, null],
    [{ name: 'staff.csv', size: 1000 }, 'Choose an Excel file (.xlsx or .xls).'],
    [{ name: 'staff.xlsx.exe', size: 1000 }, 'Choose an Excel file (.xlsx or .xls).'],
    [{ name: 'empty.xlsx', size: 0 }, 'The file is empty.'],
    [{ name: 'big.xlsx', size: 10 * 1024 * 1024 + 1 }, 'The file is larger than 10 MB.'],
  ])('%o → %s', (file, problem) => {
    expect(fileProblem(file)).toBe(problem)
  })
})

describe('column mapping', () => {
  it('suggests columns by label and alias, each column once', () => {
    expect(suggestMapping('attendance', ['Employee ID', 'Date', 'Time in', 'Time out'])).toEqual({
      employeeCode: 'Employee ID',
      date: 'Date',
      checkIn: 'Time in',
      checkOut: 'Time out',
    })
    expect(suggestMapping('attendance', ['Date']).employeeCode).toBeNull()
  })

  it('requires required fields and refuses one column for two fields', () => {
    expect(
      mappingProblems('attendance', {
        employeeCode: 'A',
        date: 'A',
        checkIn: null,
        checkOut: null,
      }),
    ).toEqual({
      date: '“A” is already used for Employee code.',
      checkIn: 'Required: choose a column.',
    })
    expect(
      mappingProblems('attendance', { employeeCode: 'A', date: 'B', checkIn: 'C', checkOut: null }),
    ).toEqual({})
  })
})

describe('row parsing', () => {
  it('reads attendance times as Pakistan wall-clock values and checks their order', () => {
    expect(
      parseRow('attendance', {
        employeeCode: 'fbx-1',
        date: '2026-10-01',
        checkIn: '09:05',
        checkOut: '',
      }),
    ).toEqual({
      ok: true,
      values: { employeeCode: 'FBX-1', date: '2026-10-01', checkIn: '09:05:00', checkOut: null },
    })
    expect(
      parseRow('attendance', {
        employeeCode: 'X',
        date: '2026-02-30',
        checkIn: '18:00',
        checkOut: '09:00',
      }),
    ).toEqual({
      ok: false,
      errors: ['Date must be YYYY-MM-DD.', 'Check-out must be after check-in.'],
    })
  })

  it('understands leave type and role names', () => {
    const leave = parseRow('leave_balances', {
      employeeCode: 'A',
      leaveType: 'Sick',
      year: '2026',
      allocated: '9',
    })
    expect(leave).toMatchObject({
      ok: true,
      values: { leaveType: 'medical_sick', year: 2026, allocated: 9 },
    })
    expect(
      parseRow('leave_balances', {
        employeeCode: 'A',
        leaveType: 'Maternity',
        year: '26',
        allocated: '-1',
      }),
    ).toEqual({
      ok: false,
      errors: [
        'Unknown leave type “Maternity”.',
        'Leave year must be a year such as 2026.',
        'Allocated days must be a whole number from 0 to 365.',
      ],
    })
    const employee = parseRow('employees', {
      firstName: 'A',
      lastName: 'B',
      email: 'A@X.TEST',
      role: 'team lead',
      department: 'ENG',
      designation: 'Team Lead',
      joiningDate: '2026-12-01',
      phone: '',
      managerEmails: 'm@x.test; n@x.test',
    })
    expect(employee).toMatchObject({
      ok: true,
      values: { email: 'a@x.test', role: 'team_lead', managerEmails: ['m@x.test', 'n@x.test'] },
    })
  })

  it('rejects leave across years and inverted dates', () => {
    expect(
      parseRow('leave_history', {
        employeeCode: 'A',
        leaveType: 'Annual',
        startDate: '2026-12-31',
        endDate: '2027-01-02',
        reason: '',
      }),
    ).toMatchObject({ ok: false, errors: ['Leave must stay within one leave year.'] })
    expect(
      parseRow('leave_history', {
        employeeCode: 'A',
        leaveType: 'Annual',
        startDate: '2026-06-10',
        endDate: '2026-06-08',
        reason: '',
      }),
    ).toMatchObject({ ok: false, errors: ['End date is before the start date.'] })
  })
})
