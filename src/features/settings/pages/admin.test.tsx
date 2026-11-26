// Phase 8 screens through the real routes: reports, settings → audit, access.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'

describe('reports (P8)', () => {
  it('a manager sees scoped reports with charts, tables and CSV export', async () => {
    await renderApp('/reports', { signedInAs: 'manager' })
    const table = await screen.findByRole(
      'table',
      { name: 'Attendance by employee' },
      { timeout: 4000 },
    )
    expect(within(table).queryByText('Kamran Aslam')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument() // HR only
    await userEvent.click(screen.getByRole('tab', { name: 'Late-In' }))
    expect(await screen.findByText('Late-In check-ins', { selector: 'h2' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Departments' }))
    expect(
      await screen.findByRole('table', { name: 'Department report' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('employees have no reports', async () => {
    await renderApp('/reports', { signedInAs: 'employee' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
  })
})

describe('settings and audit (P8)', () => {
  it('HR adds a holiday and the change appears in the read-only audit log', async () => {
    const { router } = await renderApp('/settings', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Working days and holidays' }))
    await userEvent.type(screen.getByLabelText('Date'), '2026-12-25')
    await userEvent.type(screen.getByLabelText('Name'), 'Quaid Day')
    await userEvent.click(screen.getByRole('button', { name: 'Add holiday' }))
    const list = await screen.findByRole('list', { name: 'Holidays' })
    expect(within(list).getByText(/Quaid Day/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Attendance policy' }))
    expect(screen.getByText(/on time until 9:15 AM inclusive/)).toBeInTheDocument()

    void router.navigate('/audit')
    const entries = await screen.findByRole('table', { name: 'Audit entries' }, { timeout: 4000 })
    expect(within(entries).getByText('Holidays')).toBeInTheDocument()
    expect(within(entries).queryByRole('button', { name: /delete|edit/i })).not.toBeInTheDocument()
    await userEvent.click(within(entries).getByRole('button', { name: /^Details of/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Quaid Day')).toBeInTheDocument()
  })

  it('settings and audit are HR only', async () => {
    await renderApp('/audit', { signedInAs: 'manager' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Audit entries')).not.toBeInTheDocument())
  })
})
