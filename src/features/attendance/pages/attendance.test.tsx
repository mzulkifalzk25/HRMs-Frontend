// Attendance screens through the real routes with a frozen clock (Phase 4).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockAttendanceStore } from '@/services/mock/attendance-store'
import { renderApp } from '@/test/render'

/** Freeze Date (not timers) at a Karachi wall-clock time on Wed 25 Nov 2026 and reseed mock data. */
function freezeAt(pkt: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`2026-11-25T${pkt}+05:00`))
  mockAttendanceStore.reset()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('check-in and check-out (P4-T04)', () => {
  it('checks in on time at exactly 9:15:00 and shows the Karachi clock', async () => {
    freezeAt('09:15:00')
    await renderApp('/attendance', { signedInAs: 'employee' })
    expect(await screen.findByText('9:15:00 AM', { selector: 'p' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Check in' }))
    expect(await screen.findByRole('button', { name: 'Check out' })).toBeEnabled()
    const today = screen.getByRole('region', { name: 'Today' })
    expect(within(today).getByText('On time')).toBeInTheDocument()
    expect(within(today).getByText('Check-in').nextElementSibling).toHaveTextContent('9:15:00 AM')
  })

  it('marks 9:20 as Late-In (tracking only), then checks out and closes the day', async () => {
    freezeAt('09:20:00')
    await renderApp('/attendance', { signedInAs: 'manager' })
    await userEvent.click(await screen.findByRole('button', { name: 'Check in' }))
    const today = screen.getByRole('region', { name: 'Today' })
    expect(await within(today).findByText('Late-In')).toBeInTheDocument()
    vi.setSystemTime(new Date('2026-11-25T18:02:41+05:00'))
    await userEvent.click(screen.getByRole('button', { name: 'Check out' }))
    expect(
      await screen.findByText('You have checked out for today. See you tomorrow.'),
    ).toBeInTheDocument()
    expect(within(today).getByText('Worked').nextElementSibling).toHaveTextContent('8h 42m 41s')
    expect(screen.queryByRole('button', { name: /Check (in|out)/ })).not.toBeInTheDocument()
  })

  it('disables check-in while offline and explains why', async () => {
    freezeAt('09:00:00')
    await renderApp('/attendance', { signedInAs: 'employee' })
    const button = await screen.findByRole('button', { name: 'Check in' })
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(
      await screen.findByText('You are offline. Check-in and check-out need a connection.'),
    ).toBeInTheDocument()
    expect(button).toBeDisabled()
    onLine.mockRestore()
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
  })
})

describe('my history, calendar and export (P4-T05, T06, T12)', () => {
  it('lists this month with exact times and statuses, and exports CSV', async () => {
    freezeAt('11:00:00')
    const createObjectURL = vi.fn(() => 'blob:mock')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    await renderApp('/attendance', { signedInAs: 'employee' })
    const table = await screen.findByRole('table', { name: 'My attendance history' })
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5)
    expect(within(table).queryAllByText(/^\d+h \d{2}m \d{2}s$/).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('shows an empty state and validates the date range', async () => {
    freezeAt('11:00:00')
    await renderApp('/attendance', { signedInAs: 'employee' })
    await screen.findByRole('table', { name: 'My attendance history' })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-24' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-20' } })
    expect(
      await screen.findByText('The start date must be on or before the end date.'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-22' } }) // Sunday
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-22' } })
    expect(await screen.findByText('No attendance in this period')).toBeInTheDocument()
  })

  it('shows the month calendar from service data only ("No record", never "absent")', async () => {
    freezeAt('11:00:00')
    await renderApp('/attendance', { signedInAs: 'employee' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Calendar' }))
    const calendar = await screen.findByRole('table', { name: 'Attendance calendar for 2026-11' })
    expect(within(calendar).getAllByText('No record').length).toBeGreaterThan(0)
    expect(within(calendar).queryByText(/absent/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(
      await screen.findByRole('table', { name: 'Attendance calendar for 2026-10' }),
    ).toBeInTheDocument()
  })
})

describe('team and organization records (P4-T08…T11)', () => {
  it('a manager sees their scope without correction actions', async () => {
    freezeAt('11:00:00')
    await renderApp('/attendance/records', { signedInAs: 'manager' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Team attendance' }),
    ).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Attendance records' })
    expect(within(table).queryByText('Kamran Aslam')).not.toBeInTheDocument() // Finance, other branch
    expect(within(table).queryByRole('button', { name: /^Correct/ })).not.toBeInTheDocument()
  })

  it('employees have no team records (403)', async () => {
    await renderApp('/attendance/records', { signedInAs: 'employee' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
  })

  it('HR filters missing check-outs, corrects one with a reason, and sees the history', async () => {
    freezeAt('11:00:00')
    await renderApp('/attendance/records', { signedInAs: 'hr_admin' })
    await screen.findByRole('table', { name: 'Attendance records' })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-25' } })
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'Missing check-out only')
    const table = await screen.findByRole('table', { name: 'Attendance records' })
    await waitFor(() =>
      expect(within(table).getAllByText('Missing check-out').length).toBeGreaterThan(0),
    )
    const firstRow = within(table).getAllByRole('row')[1] as HTMLElement
    await userEvent.click(within(firstRow).getByRole('button', { name: /^Correct/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Correct attendance' })
    fireEvent.change(within(dialog).getByLabelText('Check-out'), { target: { value: '18:05:00' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save correction' }))
    expect(
      await within(dialog).findByText('Give a reason for this correction (at least 5 characters).'),
    ).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Reason (required)'), 'Forgot to check out')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save correction' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.selectOptions(screen.getByLabelText('Show'), 'Corrected only')
    const corrected = await screen.findByRole('table', { name: 'Attendance records' })
    await waitFor(() => expect(within(corrected).getAllByText('Corrected').length).toBe(1))
    await userEvent.click(within(corrected).getByRole('button', { name: /^Correction history/ }))
    const history = await screen.findByRole('dialog', { name: 'Correction history' })
    expect(await within(history).findByText('Reason: Forgot to check out')).toBeInTheDocument()
    expect(within(history).getByText(/Sana Demo/)).toBeInTheDocument()
    expect(within(history).getByText(/Out: none → 6:05:00 PM/)).toBeInTheDocument()
  })

  it('rejects a check-out before the check-in in the correction form', async () => {
    freezeAt('11:00:00')
    await renderApp('/attendance/records', { signedInAs: 'hr_admin' })
    const table = await screen.findByRole('table', { name: 'Attendance records' })
    const row = within(table).getAllByRole('row')[1] as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: /^Correct/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Correct attendance' })
    fireEvent.change(within(dialog).getByLabelText('Check-in'), { target: { value: '10:00:00' } })
    fireEvent.change(within(dialog).getByLabelText('Check-out'), { target: { value: '09:00:00' } })
    await userEvent.type(within(dialog).getByLabelText('Reason (required)'), 'Testing order')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save correction' }))
    expect(await within(dialog).findByText('Check-out must be after check-in.')).toBeInTheDocument()
  })
})
