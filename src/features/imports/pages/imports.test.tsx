// Import workflow through the real routes (Phase 7): upload → preview/mapping → dry run → import
// → detail and history.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'

const xlsx = (name = 'staff.xlsx') =>
  new File(['fake'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

describe('imports (P7)', () => {
  it('runs the full employee import flow without silent overwrites', async () => {
    const { router } = await renderApp('/imports', { signedInAs: 'hr_admin' })
    expect(await screen.findByText('No imports yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'New import' }))

    await userEvent.upload(await screen.findByLabelText('Excel file'), xlsx())
    await userEvent.click(screen.getByRole('button', { name: 'Upload and preview' }))
    expect(
      await screen.findByText(/Mock mode: these are fictional sample rows/),
    ).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'File preview' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Designation/)).toHaveValue('Job title') // suggested via alias

    await userEvent.click(screen.getByRole('button', { name: 'Run dry run' }))
    const dry = await screen.findByRole('region', { name: '3. Dry run' })
    expect(within(dry).getByText('Will be created').nextElementSibling).toHaveTextContent('2')
    const results = await within(dry).findByRole('table', { name: 'Import results by row' })
    expect(
      within(results).getAllByText(/Not changed \(choose “update existing records”/),
    ).toHaveLength(1)

    await userEvent.click(within(dry).getByRole('button', { name: 'Import 2 rows' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent('2 records will be created and 0 updated')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/imports\/imp-/))
    expect(await screen.findByText('Imported')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'All imports' }))
    const history = await screen.findByRole('table', { name: 'Import history' })
    expect(within(history).getByText('2 / 0 / 2 / 3')).toBeInTheDocument()
  })

  it('rejects files that are not Excel', async () => {
    await renderApp('/imports/new', { signedInAs: 'hr_admin' })
    await userEvent.upload(await screen.findByLabelText('Excel file'), xlsx('staff.csv'), {
      applyAccept: false,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Upload and preview' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose an Excel file (.xlsx or .xls).',
    )
  })

  it('a changed mapping needs a new dry run; missing required columns block it', async () => {
    await renderApp('/imports/new', { signedInAs: 'hr_admin' })
    await userEvent.selectOptions(
      await screen.findByLabelText('What are you importing?'),
      'Historical attendance',
    )
    await userEvent.upload(screen.getByLabelText('Excel file'), xlsx('att.xlsx'))
    await userEvent.click(screen.getByRole('button', { name: 'Upload and preview' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Run dry run' }))
    expect(await screen.findByRole('region', { name: '3. Dry run' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText(/^Date/), '')
    expect(screen.queryByRole('region', { name: '3. Dry run' })).not.toBeInTheDocument()
    expect(screen.getByText('Required: choose a column.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run dry run' })).toBeDisabled()
  })

  it('is for HR only', async () => {
    await renderApp('/imports', { signedInAs: 'manager' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
  })
})
