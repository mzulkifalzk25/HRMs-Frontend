// Leave and approval screens through the real routes with a frozen clock (Phase 5).
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAttendanceStore } from '@/services/mock/attendance-store'
import { mockLeaveStore } from '@/services/mock/leave-store'
import { renderApp } from '@/test/render'

// Wednesday 25 Nov 2026, 11:00 Pakistan time.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T11:00:00+05:00'))
  mockLeaveStore.reset()
  mockAttendanceStore.reset()
})
afterEach(() => {
  vi.useRealTimers()
})

const dialog = () => screen.findByRole('alertdialog')

/** Opens a request from the page's table (jsdom also renders the mobile list). */
async function openRequest(name: RegExp) {
  const table = await screen.findByRole('table')
  await userEvent.click(await within(table).findByRole('link', { name }))
  return screen.findByRole('region', { name: 'Who is involved' })
}

describe('my leave (P5-T03, P5-T05, P5-T14)', () => {
  it('shows balances per category, own requests and the ledger', async () => {
    await renderApp('/leave', { signedInAs: 'employee' })
    const balances = await screen.findByRole('list', { name: 'Leave balances' })
    const casual = within(balances).getByText('Casual').closest('li') as HTMLElement
    expect(casual).toHaveTextContent('6of 7 left')
    expect(within(casual).getByRole('meter', { name: 'Casual leave used' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    const table = await screen.findByRole('table', { name: 'My leave requests' })
    expect(within(table).getByText('Declined')).toBeInTheDocument()
    expect(within(table).getByText('Approved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Ledger' }))
    const ledger = await screen.findByRole('table', { name: 'My leave ledger' })
    expect(within(ledger).getAllByText('Allocation')).toHaveLength(3)
    expect(within(ledger).getByText('Approved leave')).toBeInTheDocument()
  })
})

describe('applying for leave (P5-T06, P5-T13, P5-T16)', () => {
  it('computes working days, shows who decides with HR locked in, submits and cancels', async () => {
    const { router } = await renderApp('/leave/apply', { signedInAs: 'employee' })
    const involved = await screen.findByRole('region', { name: 'Who is involved' })
    expect(await within(involved).findByText('Imran Demo')).toBeInTheDocument()
    expect(within(involved).getByText('Zainab Demo')).toBeInTheDocument()
    expect(within(involved).getByText(/\(HR, cannot be removed\)/)).toBeInTheDocument()
    expect(within(involved).getByText('Sana Demo')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Leave type'), 'casual')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-12-11' } }) // Fri
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-12-14' } }) // Mon
    expect(await screen.findByText('2 days (working days)')).toBeInTheDocument()
    expect(screen.getByText('6 days left, 4 days after this request.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(await screen.findByText('Give a reason (at least 5 characters).')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Reason'), 'Family wedding')
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/leave\/requests\//))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Casual leave' }),
    ).toBeInTheDocument()
    const details = screen.getByRole('region', { name: 'Details' })
    expect(within(details).getByText('Pending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel request' }))
    expect(await within(details).findByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText(/cancelled the request/)).toBeInTheDocument()
  })

  it('validates dates, balance and attachments before sending', async () => {
    await renderApp('/leave/apply', { signedInAs: 'employee' })
    await screen.findByRole('region', { name: 'Who is involved' })
    await userEvent.selectOptions(screen.getByLabelText('Leave type'), 'casual')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-12-12' } }) // Sat
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-12-13' } }) // Sun
    await userEvent.type(screen.getByLabelText('Reason'), 'Weekend trip')
    const file = new File(['x'], 'notes.docx', { type: 'application/msword' })
    await userEvent.upload(screen.getByLabelText('Attachment (optional)'), file, {
      applyAccept: false,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(
      await screen.findByText('These dates contain no working days (Monday to Friday).'),
    ).toBeInTheDocument()
    expect(screen.getByText('Attach a PDF, JPG or PNG file.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-12-14' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-12-22' } })
    expect(
      await screen.findByText('This request needs 7 days, but only 6 days remain.'),
    ).toBeInTheDocument()
  })

  it('the only HR Administrator is told nobody else can decide', async () => {
    await renderApp('/leave/apply', { signedInAs: 'hr_admin' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/no other HR Administrator/)
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled()
  })
})

describe('approvals (P5-T09…T12)', () => {
  it('a manager approves from the inbox; the balance is deducted', async () => {
    await renderApp('/leave/approvals', { signedInAs: 'manager' })
    const table = await screen.findByRole('table', { name: 'Waiting for you' })
    expect(within(table).getAllByText('Your decision').length).toBeGreaterThan(0)
    const involved = await openRequest(/Open Hamza Kareem, Annual leave/)
    expect(within(involved).getByText('Imran Demo')).toBeInTheDocument()
    expect(screen.getByText(/Coverage arranged with the team/)).toBeInTheDocument() // TL's note
    const details = screen.getByRole('region', { name: 'Details' })

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    const confirm = await dialog()
    expect(confirm).toHaveTextContent('3 days will be deducted from Annual leave.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Approve' }))
    expect(await within(details).findByText('Approved')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('declining requires a reason', async () => {
    await renderApp('/leave/approvals', { signedInAs: 'manager' })
    await openRequest(/Open Bilal Rana, Casual leave/)
    const details = screen.getByRole('region', { name: 'Details' })
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }))
    const confirm = await dialog()
    const button = within(confirm).getByRole('button', { name: 'Decline' })
    expect(button).toBeDisabled()
    await userEvent.type(within(confirm).getByLabelText(/Reason for declining/), 'Release day')
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(await within(details).findByText('Declined')).toBeInTheDocument()
    expect(screen.getByText('“Release day”')).toBeInTheDocument()
  })

  it('a Team Lead recommends but cannot decide (D-065)', async () => {
    await renderApp('/leave/approvals', { signedInAs: 'team_lead' })
    await openRequest(/Open Bilal Rana, Casual leave/)
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    const details = screen.getByRole('region', { name: 'Details' })
    await userEvent.click(screen.getByRole('button', { name: 'Recommend approval' }))
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Recommend' }))
    expect(await within(details).findByText('Under review')).toBeInTheDocument()
    expect(screen.getByText(/recommended approval/)).toBeInTheDocument()
  })
})

describe('HR (P5-T10, P5-T14, P5-T15)', () => {
  it('sees every request and can decide one as HR with a reason', async () => {
    await renderApp('/leave/records', { signedInAs: 'hr_admin' })
    const table = await screen.findByRole('table', { name: 'Leave requests' })
    expect(within(table).getByText('Kamran Aslam')).toBeInTheDocument()
    await openRequest(/Open Nida Parvez, Annual leave/)
    await userEvent.click(screen.getByRole('button', { name: 'Approve as HR' }))
    const confirm = await dialog()
    await userEvent.type(
      within(confirm).getByLabelText(/Reason for the HR decision/),
      'Senior PM is away',
    )
    await userEvent.click(within(confirm).getByRole('button', { name: 'Approve as HR' }))
    expect(await screen.findByText(/approved the request as HR \(override\)/)).toBeInTheDocument()
  })

  it('adjusts an allocation with a reason and sees it in the ledger', async () => {
    await renderApp('/leave/balances', { signedInAs: 'hr_admin' })
    await screen.findByRole('option', { name: 'Ali Demo' })
    await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Ali Demo')
    await userEvent.click(await screen.findByRole('button', { name: 'Adjust allocation' }))
    const form = await screen.findByRole('dialog', { name: 'Adjust allocation' })
    await userEvent.type(within(form).getByLabelText(/Days to add/), '2')
    await userEvent.click(within(form).getByRole('button', { name: 'Save adjustment' }))
    expect(await within(form).findByText(/Give a reason/)).toBeInTheDocument()
    await userEvent.type(within(form).getByLabelText('Reason (required)'), 'Long service award')
    await userEvent.click(within(form).getByRole('button', { name: 'Save adjustment' }))
    const ledger = await screen.findByRole('table', { name: 'Leave ledger of Ali Demo' })
    expect(await within(ledger).findByText('HR adjustment')).toBeInTheDocument()
    expect(within(ledger).getByText('Long service award')).toBeInTheDocument()
  })
})

describe('access (D-044)', () => {
  it('employees have no leave records page', async () => {
    await renderApp('/leave/records', { signedInAs: 'employee' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
  })

  it('a request outside your scope is not found', async () => {
    await renderApp('/leave/requests/lr-unknown', { signedInAs: 'employee' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Leave request not found' }),
    ).toBeInTheDocument()
  })
})
