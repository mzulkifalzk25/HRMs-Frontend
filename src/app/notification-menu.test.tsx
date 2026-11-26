// Notification center in the top bar (P6-T03), with a frozen clock: 08:00 Pakistan time, before
// the 9:15 reminder, so counts are deterministic.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAttendanceStore } from '@/services/mock/attendance-store'
import { mockLeaveStore } from '@/services/mock/leave-store'
import { mockNotificationStore } from '@/services/mock/notification-store'
import { renderApp } from '@/test/render'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T08:00:00+05:00'))
  mockNotificationStore.reset()
  mockLeaveStore.reset()
  mockAttendanceStore.reset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('notification center', () => {
  it('shows the unread count, opens a notification and marks it read', async () => {
    const { router } = await renderApp('/profile', { signedInAs: 'employee' })
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    await userEvent.click(bell)
    const menu = await screen.findByRole('menu')
    const item = await within(menu).findByRole(
      'menuitem',
      { name: /^Engineering town hall on Friday/ },
      { timeout: 4000 },
    )
    expect(
      within(menu).getByRole('menuitem', { name: 'View all notifications' }),
    ).toBeInTheDocument()
    await userEvent.click(item)
    await waitFor(() => expect(router.state.location.pathname).toBe('/announcements'))
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('marks everything as read and closes with Escape', async () => {
    await renderApp('/profile', { signedInAs: 'manager' })
    await userEvent.click(
      await screen.findByRole('button', { name: /^Notifications, \d+ unread$/ }),
    )
    const menu = await screen.findByRole('menu')
    expect(
      await within(menu).findAllByText(/Decision needed/, undefined, { timeout: 4000 }),
    ).not.toHaveLength(0)
    await userEvent.click(within(menu).getByRole('button', { name: 'Mark all as read' }))
    await waitFor(() =>
      expect(
        within(menu).queryByRole('button', { name: 'Mark all as read' }),
      ).not.toBeInTheDocument(),
    )
    // The page behind an open menu is hidden from assistive technology; Escape closes it.
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })
})
