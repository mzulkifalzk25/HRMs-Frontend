// Notification screens through the real routes with a frozen clock (Phase 6).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAttendanceStore } from '@/services/mock/attendance-store'
import { mockLeaveStore } from '@/services/mock/leave-store'
import { mockNotificationStore } from '@/services/mock/notification-store'
import { renderApp } from '@/test/render'

/** Freeze Date (not timers) at a Pakistan time on Wed 25 Nov 2026 and reseed the stores. */
function freezeAt(pkt: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`2026-11-25T${pkt}+05:00`))
  mockNotificationStore.reset()
  mockLeaveStore.reset()
  mockAttendanceStore.reset()
}
beforeEach(() => freezeAt('08:00:00'))
afterEach(() => {
  vi.useRealTimers()
})

const list = () => screen.findByRole('list', { name: 'Notifications' }, { timeout: 4000 })

describe('notification history (P6-T04)', () => {
  it('lists notifications with filters and marks one as read', async () => {
    await renderApp('/notifications', { signedInAs: 'employee' })
    const items = await list()
    expect(within(items).getByText('Your Annual leave was declined')).toBeInTheDocument()
    expect(within(items).getByText('Engineering town hall on Friday')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Announcement')
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Notifications' })).queryByText(
          'Your Annual leave was declined',
        ),
      ).not.toBeInTheDocument(),
    )
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'Unread only')
    const unread = await list()
    await waitFor(() => expect(within(unread).getAllByRole('listitem')).toHaveLength(1))
    await userEvent.click(
      within(unread).getByRole('button', {
        name: 'Mark "Engineering town hall on Friday" as read',
      }),
    )
    expect(await screen.findByText('No notifications')).toBeInTheDocument()
  })

  it('opening a notification goes to the related item', async () => {
    const { router } = await renderApp('/notifications', { signedInAs: 'employee' })
    const items = await list()
    await userEvent.click(
      within(items).getByRole('button', { name: /Your Annual leave was declined/ }),
    )
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/leave\/requests\//))
  })

  it('shows attendance reminders after 9:15 for someone who has not checked in', async () => {
    freezeAt('09:30:00')
    await renderApp('/notifications', { signedInAs: 'employee' })
    const items = await list()
    expect(within(items).getByText('You have not checked in today')).toBeInTheDocument()
  })
})

describe('preferences (D-093)', () => {
  it('mutes reminders; leave and approval notifications stay on', async () => {
    freezeAt('09:30:00')
    await renderApp('/notifications', { signedInAs: 'manager' })
    const prefs = await screen.findByRole('region', { name: 'Preferences' })
    const always = await within(prefs).findByRole('list', { name: 'Always on' })
    expect(within(always).getByText('Action needed')).toBeInTheDocument()
    const reminders = within(prefs).getByRole('checkbox', { name: /Receive attendance reminders/ })
    expect(reminders).toBeChecked()
    await userEvent.click(reminders)
    await userEvent.click(within(prefs).getByRole('button', { name: 'Save preferences' }))
    await waitFor(() =>
      expect(
        within(prefs).getByRole('checkbox', { name: /Receive attendance reminders/ }),
      ).not.toBeChecked(),
    )
    expect(
      mockNotificationStore.notify({
        recipientId: 'u-mgr-001',
        type: 'attendance_reminder',
        title: 'R',
      }),
    ).toBeNull()
  })
})

describe('announcements page (P6-T08)', () => {
  it('shows the announcements that reach you, with audience and expiry', async () => {
    await renderApp('/announcements', { signedInAs: 'employee' })
    const townHall = await screen.findByRole('article', { name: 'Engineering town hall on Friday' })
    expect(within(townHall).getByText('Departments: Engineering')).toBeInTheDocument()
    expect(within(townHall).getByText(/shown until 2 Dec 2026/)).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Welcome to FormbaxHR' })).toBeInTheDocument()
  })

  it('people outside the audience do not see it', async () => {
    await renderApp('/announcements', { signedInAs: 'senior_pm' })
    expect(await screen.findByRole('article', { name: 'Welcome to FormbaxHR' })).toBeInTheDocument()
    expect(
      screen.queryByRole('article', { name: 'Engineering town hall on Friday' }),
    ).not.toBeInTheDocument()
  })
})
