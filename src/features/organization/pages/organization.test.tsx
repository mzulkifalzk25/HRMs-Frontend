// Organization management and org chart through the real routes (Phase 3).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'

describe('organization management (P3-T08…T11)', () => {
  it('is HR only', async () => {
    await renderApp('/organization', { signedInAs: 'manager' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
  })

  it('adds a department and validates the name', async () => {
    await renderApp('/organization', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('button', { name: 'Add department' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add department' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('Name must have at least 2 characters.'),
    ).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Legal')
    await userEvent.type(within(dialog).getByLabelText('Code (optional)'), 'lgl')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Legal')).toBeInTheDocument()
    expect(screen.getByText('LGL · 0 people')).toBeInTheDocument()
  })

  it('shows a server error for a duplicate name on the field', async () => {
    await renderApp('/organization', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('button', { name: 'Add department' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'engineering')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('This name is already used.')).toBeInTheDocument()
  })

  it('deactivates with confirmation and warns about people still assigned', async () => {
    await renderApp('/organization', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Finance' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Finance?' })
    expect(dialog).toHaveTextContent('2 people are still in this department.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByRole('button', { name: 'Reactivate Finance' })).toBeInTheDocument()
  })

  it('edits team members and lead, and the change shows on the list', async () => {
    await renderApp('/organization', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Teams' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Quality Assurance' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit Quality Assurance' })
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Team lead (optional)'),
      'Mariam Siddiq',
    )
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Danish Malik/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Engineering · Lead: Mariam Siddiq · 1 members'),
    ).toBeInTheDocument()
  })

  it('checks project roles on the server', async () => {
    await renderApp('/organization', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Projects' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Add project' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add project' })
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Payroll API')
    await userEvent.type(within(dialog).getByLabelText('Code'), 'PPR') // already used
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('This code is already used.')).toBeInTheDocument()
  })
})

describe('org chart (P3-T13)', () => {
  it('is visible to every role, with a list view by default on small screens', async () => {
    await renderApp('/organization/chart', { signedInAs: 'employee' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Org chart' })).toBeInTheDocument()
    // jsdom has no matchMedia → treated as a small screen → list view.
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('region', { name: 'No manager' })).toHaveTextContent('Sana Demo')
    expect(screen.getByRole('region', { name: 'Reports to Imran Demo' })).toHaveTextContent(
      'Bilal Rana',
    )
    expect(screen.getByRole('region', { name: 'Reports to Farah Demo' })).toHaveTextContent(
      'Bilal Rana',
    )
  })

  it('shows a keyboard-navigable tree; multi-manager people appear once', async () => {
    await renderApp('/organization/chart', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('button', { name: 'Tree' }))
    const tree = await screen.findByRole('tree', { name: 'Reporting hierarchy' })
    const imran = within(tree).getByRole('treeitem', { name: /^Imran Demo, Engineering Manager/ })
    expect(imran).toHaveAttribute('aria-expanded', 'true')
    expect(within(tree).getAllByText('Bilal Rana')).toHaveLength(1)
    expect(within(tree).getByText(/Also reports to Farah Demo/)).toBeInTheDocument()

    imran.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(imran).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard('{ArrowRight}')
    expect(imran).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAttribute('role', 'treeitem')
    expect(document.activeElement).not.toBe(imran)
    await userEvent.keyboard('{Home}')
    expect(document.activeElement?.getAttribute('aria-level')).toBe('1')
  })

  it('searches and keeps the managers chain of matches; hides inactive people unless asked', async () => {
    await renderApp('/organization/chart', { signedInAs: 'hr_admin' })
    await userEvent.click(await screen.findByRole('button', { name: 'Tree' }))
    await userEvent.type(screen.getByLabelText('Find a person'), 'omar')
    const tree = await screen.findByRole('tree')
    await waitFor(() =>
      expect(
        within(tree)
          .getAllByRole('treeitem')
          .map((item) => item.getAttribute('aria-label')?.split(',')[0]),
      ).toEqual(['Imran Demo', 'Hina Tariq', 'Omar Farooq']),
    )
    await userEvent.clear(screen.getByLabelText('Find a person'))
    expect(screen.queryByText('Faisal Raza')).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Show inactive people'))
    await userEvent.type(screen.getByLabelText('Find a person'), 'faisal')
    expect(await screen.findByText('Faisal Raza')).toBeInTheDocument()
  })
})
