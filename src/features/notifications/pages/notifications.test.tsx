// Notification screens through the real routes with a frozen clock (Phase 6).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAttendanceStore } from '@/services/mock/attendance-store'
import { mockLeaveStore } from '@/services/mock/leave-store'
import { setMockViewer } from '@/services/mock/mock-session'
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

/** Look at the mock backend as another person (the signed-in UI user is restored after). */
function setViewer(id: string, role: 'employee' | 'hr_admin' = 'employee') {
  setMockViewer({ id, role })
}

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

describe('HR announcements (P6-T08, D-093)', () => {
  it('HR publishes to a team after validation, the team is notified, and HR archives it', async () => {
    await renderApp('/announcements', { signedInAs: 'hr_admin' })
    await screen.findByRole('article', { name: 'Welcome to FormbaxHR' })
    await userEvent.click(screen.getByRole('button', { name: 'New announcement' }))
    const form = await screen.findByRole('dialog', { name: 'New announcement' })
    await userEvent.selectOptions(within(form).getByLabelText('Audience'), 'Teams')
    await userEvent.click(within(form).getByRole('button', { name: 'Publish' }))
    expect(await within(form).findByText('Choose at least one team.')).toBeInTheDocument()
    expect(within(form).getByText('Use 3 to 120 characters.')).toBeInTheDocument()

    await userEvent.type(within(form).getByLabelText('Title'), 'Frontend demo day')
    await userEvent.type(within(form).getByLabelText('Message'), 'Show your work on Thursday.')
    await userEvent.click(await within(form).findByRole('checkbox', { name: 'Frontend' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Publish' }))
    const card = await screen.findByRole('article', { name: 'Frontend demo day' })
    expect(within(card).getByText('Teams: Frontend')).toBeInTheDocument()
    expect(within(card).getByText(/shown until archived/)).toBeInTheDocument()

    // Ali (Frontend team) is notified; Omar (Backend) is not.
    const reach = (id: string) => {
      setViewer(id)
      return mockNotificationStore.list({ page: 1, pageSize: 50 }).results.map((n) => n.title)
    }
    expect(reach('u-emp-001')).toContain('Frontend demo day')
    expect(reach('e-105')).not.toContain('Frontend demo day')
    setViewer('u-hr-001', 'hr_admin')

    await userEvent.click(within(card).getByRole('button', { name: 'Archive "Frontend demo day"' }))
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive' }))
    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Frontend demo day' })).not.toBeInTheDocument(),
    )
    await userEvent.click(screen.getByLabelText('Show archived and expired'))
    const archived = await screen.findByRole('article', { name: 'Frontend demo day' })
    expect(within(archived).getByText('Archived')).toBeInTheDocument()
  })

  it('only HR can create announcements', async () => {
    await renderApp('/announcements', { signedInAs: 'manager' })
    await screen.findByRole('article', { name: 'Welcome to FormbaxHR' })
    expect(screen.queryByRole('button', { name: 'New announcement' })).not.toBeInTheDocument()
  })
})
