import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from './confirm-dialog'
import { EmptyState } from './empty-state'
import { ErrorState } from './error-state'
import { CardSkeleton, ListSkeleton } from './loading-skeletons'

describe('EmptyState', () => {
  it('shows title, description and action', () => {
    render(
      <EmptyState
        title="No leave requests"
        description="Requests you submit appear here."
        action={<Button>Apply for leave</Button>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'No leave requests' })).toBeInTheDocument()
    expect(screen.getByText('Requests you submit appear here.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply for leave' })).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('is announced as an alert and shows the message', () => {
    render(<ErrorState message="Cannot reach the server." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onRetry and disables the button while retrying', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<ErrorState message="x" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender(<ErrorState message="x" onRetry={onRetry} isRetrying />)
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  })
})

describe('loading skeletons', () => {
  it('are hidden from assistive technology', () => {
    const { container } = render(
      <>
        <CardSkeleton />
        <ListSkeleton rows={2} />
      </>,
    )
    const hidden = container.querySelectorAll('[aria-hidden="true"]')
    expect(hidden.length).toBeGreaterThanOrEqual(2)
  })
})

describe('PageHeader', () => {
  it('renders the page h1, description and actions', () => {
    render(<PageHeader title="Employees" description="All staff" actions={<Button>Add</Button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Employees' })).toBeInTheDocument()
    expect(screen.getByText('All staff')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})

function DialogHarness(
  props: Partial<Parameters<typeof ConfirmDialog>[0]> & { onConfirm: (reason?: string) => void },
) {
  const [open, setOpen] = useState(true)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Deactivate employee?"
      description="They will no longer be able to sign in."
      confirmLabel="Deactivate"
      destructive
      {...props}
    />
  )
}

describe('ConfirmDialog', () => {
  it('confirms without a reason when none is required', async () => {
    const onConfirm = vi.fn()
    render(<DialogHarness onConfirm={onConfirm} />)
    expect(screen.getByRole('alertdialog', { name: 'Deactivate employee?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it('requires a non-blank reason and passes it trimmed', async () => {
    const onConfirm = vi.fn()
    render(
      <DialogHarness
        title="Correct attendance?"
        confirmLabel="Save correction"
        reason={{ label: 'Reason for correction' }}
        onConfirm={onConfirm}
      />,
    )
    const confirm = screen.getByRole('button', { name: 'Save correction' })
    expect(confirm).toBeDisabled()

    const reason = screen.getByLabelText(/Reason for correction/)
    expect(reason).toBeRequired()
    await userEvent.type(reason, '   ')
    expect(confirm).toBeDisabled()

    await userEvent.clear(reason)
    await userEvent.type(reason, '  Biometric device was offline  ')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('Biometric device was offline')
  })

  it('closes on cancel without confirming', async () => {
    const onConfirm = vi.fn()
    render(<DialogHarness onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disables both buttons while the action is pending', () => {
    render(<DialogHarness onConfirm={vi.fn()} isPending />)
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
