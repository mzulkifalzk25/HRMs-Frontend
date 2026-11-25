// Employee directory, profile, create, edit and deactivate through the real routes (Phase 3).
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api'
import { services } from '@/services/registry'
import { renderApp } from '@/test/render'

const rowNames = () =>
  within(screen.getAllByRole('table')[0] as HTMLElement)
    .getAllByRole('link')
    .map((link) => link.textContent)

async function openDirectory(
  path = '/employees',
  role: 'hr_admin' | 'manager' | 'team_lead' = 'hr_admin',
) {
  const app = await renderApp(path, { signedInAs: role })
  await screen.findByRole('heading', { level: 1, name: 'Employees' })
  await screen.findAllByRole('table')
  return app
}

describe('directory (P3-T03)', () => {
  it('lists everyone for HR, sorted by last name, with pagination', async () => {
    await openDirectory('/employees?size=10')
    expect(rowNames()).toHaveLength(10)
    expect(rowNames()[0]).toBe('Sadia Akram') // default sort: last name (Akram, Aslam, Demo, …)
    expect(screen.getByText('Showing 1–10 of 21 employees')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 11–20 of 21 employees')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 21–21 of 21 employees')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('sorts by joining date and announces the sort direction', async () => {
    const { router } = await openDirectory()
    const header = screen.getByRole('columnheader', { name: /Joined/ })
    expect(header).toHaveAttribute('aria-sort', 'none')
    await userEvent.click(within(header).getByRole('button'))
    await waitFor(() => expect(router.state.location.search).toContain('ordering=joining_date'))
    expect(screen.getByRole('columnheader', { name: /Joined/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    await waitFor(() => expect(rowNames()[0]).toBe('Farah Demo')) // joined 2019
    await userEvent.click(
      within(screen.getByRole('columnheader', { name: /Joined/ })).getByRole('button'),
    )
    await waitFor(() => expect(rowNames()[0]).toBe('Sadia Akram')) // joins 2026-12-01
  })

  it('combines search and filters, and clears them', async () => {
    const { router } = await openDirectory()
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Engineering')
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'Team Lead')
    await waitFor(() => expect(rowNames()).toEqual(['Zainab Demo', 'Hina Tariq']))
    await userEvent.type(screen.getByLabelText('Search employees'), 'hina')
    await waitFor(() => expect(rowNames()).toEqual(['Hina Tariq']))
    expect(router.state.location.search).toContain('q=hina')
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() =>
      expect(screen.getByText('Showing 1–21 of 21 employees')).toBeInTheDocument(),
    )
  })

  it('shows an empty state when nothing matches', async () => {
    await renderApp('/employees?q=nobody-at-all', { signedInAs: 'hr_admin' })
    expect(await screen.findByText('No employees match these filters')).toBeInTheDocument()
  })

  it('shows an error with retry when loading fails', async () => {
    const spy = vi
      .spyOn(services.employees, 'list')
      .mockRejectedValueOnce(
        new ApiError({ status: 503, code: 'server_error', message: 'The server had a problem.' }),
      )
    await renderApp('/employees', { signedInAs: 'hr_admin' })
    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findAllByRole('table')).toBeTruthy()
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('scope and role UX (P3-T14)', () => {
  it('a team lead sees only their team and no HR actions', async () => {
    await openDirectory('/employees', 'team_lead')
    expect(screen.getByText('People in your reporting scope.')).toBeInTheDocument()
    expect(rowNames().sort()).toEqual(['Ali Demo', 'Bilal Rana', 'Hamza Kareem', 'Sadia Akram'])
    expect(screen.queryByRole('link', { name: 'Add employee' })).not.toBeInTheDocument()
    const table = screen.getAllByRole('table')[0] as HTMLElement // the mobile card list also exists in jsdom
    await userEvent.click(within(table).getByRole('link', { name: 'Ali Demo' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ali Demo' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('an employee has no directory (403) but can open their own record', async () => {
    await renderApp('/employees', { signedInAs: 'employee' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
  })

  it('records outside the scope look like they do not exist', async () => {
    await renderApp('/employees/e-112', { signedInAs: 'team_lead' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Employee not found' }),
    ).toBeInTheDocument()
  })

  it('HR-only pages show 403 to others', async () => {
    await renderApp('/employees/new', { signedInAs: 'manager' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
  })
})

describe('profile (P3-T04)', () => {
  it('shows work information and reporting with names, including several managers', async () => {
    await renderApp('/employees/e-103', { signedInAs: 'hr_admin' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Bilal Rana' })).toBeInTheDocument()
    expect(screen.getByText('Imran Demo, Farah Demo')).toBeInTheDocument()
    expect(screen.getByText('Payroll Portal Revamp, Mobile Attendance App')).toBeInTheDocument()
    expect(screen.getByText('FBX-1009')).toBeInTheDocument()
  })

  it('explains a person without a manager', async () => {
    await renderApp('/employees/e-112', { signedInAs: 'hr_admin' })
    expect(await screen.findByText('No manager (leave requests go to HR)')).toBeInTheDocument()
  })
})

async function fillNewEmployee(email = 'new.person@formbaxhr.test') {
  await userEvent.type(await screen.findByLabelText('First name'), 'New')
  await userEvent.type(screen.getByLabelText('Last name'), 'Person')
  await userEvent.type(screen.getByLabelText('Work email'), email)
  await userEvent.selectOptions(screen.getByLabelText('Department'), 'Engineering')
  await userEvent.selectOptions(screen.getByLabelText('Designation'), 'Software Engineer')
  fireEvent.change(screen.getByLabelText('Joining date'), { target: { value: '2026-12-15' } })
}

describe('create employee (P3-T05)', () => {
  it('validates required fields', async () => {
    await renderApp('/employees/new', { signedInAs: 'hr_admin' })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create employee and send invitation' }),
    )
    expect(await screen.findByText('Enter the first name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a department.')).toBeInTheDocument()
    expect(screen.getByText('Enter the joining date.')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('creates an invited employee with managers and opens the profile', async () => {
    const { router } = await renderApp('/employees/new', { signedInAs: 'hr_admin' })
    await fillNewEmployee()
    const managers = screen.getByRole('group', { name: /Managers/ })
    await userEvent.type(within(managers).getByRole('searchbox'), 'imran')
    await userEvent.click(within(managers).getByRole('checkbox', { name: /Imran Demo/ }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Create employee and send invitation' }),
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'New Person' })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/employees\/e-\d+$/)
    expect(screen.getByText('Invitation sent')).toBeInTheDocument()
    expect(screen.getByText('Imran Demo')).toBeInTheDocument()
  })

  it('shows a duplicate email from the server on the email field', async () => {
    await renderApp('/employees/new', { signedInAs: 'hr_admin' })
    await fillNewEmployee('manager@formbaxhr.test')
    await userEvent.click(
      screen.getByRole('button', { name: 'Create employee and send invitation' }),
    )
    expect(
      await screen.findByText('An employee with this email already exists.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Please correct the highlighted fields.')
  })
})

describe('edit employee (P3-T06, P3-T12)', () => {
  it('sends only the changed fields', async () => {
    const spy = vi.spyOn(services.employees, 'update')
    await renderApp('/employees/e-101/edit', { signedInAs: 'hr_admin' })
    const phone = await screen.findByLabelText('Phone (optional)')
    await userEvent.type(phone, '+92 300 1234567')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hamza Kareem' }),
    ).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('e-101', { phone: '+92 300 1234567' })
  })

  it('previews a reporting loop and blocks saving', async () => {
    await renderApp('/employees/u-mgr-001/edit', { signedInAs: 'hr_admin' })
    const managers = await screen.findByRole('group', { name: /Managers/ })
    await userEvent.type(within(managers).getByRole('searchbox'), 'omar')
    await userEvent.click(within(managers).getByRole('checkbox', { name: /Omar Farooq/ }))
    expect(
      await screen.findByText(
        'This would create a reporting loop: Imran Demo → Omar Farooq → Hina Tariq → Imran Demo.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await userEvent.click(within(managers).getByRole('checkbox', { name: /Omar Farooq/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled())
  })

  it('locks the role when HR edits their own record (provisional Q-ORG-05)', async () => {
    await renderApp('/employees/u-hr-001/edit', { signedInAs: 'hr_admin' })
    const role = await screen.findByLabelText('Role')
    expect(role).toHaveAttribute('readonly')
    expect(role).toHaveAccessibleDescription(/cannot change your own role/)
  })
})

describe('deactivate and reactivate (P3-T07)', () => {
  it('requires a reason, deactivates, shows the reason, and reactivates', async () => {
    await renderApp('/employees/e-101', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Hamza Kareem?' })
    const confirm = within(dialog).getByRole('button', { name: 'Deactivate' })
    expect(confirm).toBeDisabled()
    await userEvent.type(
      within(dialog).getByLabelText(/Reason for deactivation/),
      'Resigned, last day today',
    )
    await userEvent.click(confirm)
    expect(await screen.findByText('Reason: Resigned, last day today')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
    )
    expect(await screen.findByText('Active')).toBeInTheDocument()
  })

  it('does not offer deactivation on your own record', async () => {
    await renderApp('/employees/u-hr-001', { signedInAs: 'hr_admin' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Sana Demo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })
})
