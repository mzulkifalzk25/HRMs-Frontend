import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from '../lib/notification-types'
import type { Notification } from '../schemas/notification.schema'
import { NotificationContent } from './notification-item'

const base: Omit<Notification, 'type'> = {
  id: 'n-1',
  title: 'Something happened',
  body: 'More detail',
  link: '/leave',
  actorName: null,
  createdAt: '2026-11-25T10:00:00.000+05:00',
  read: false,
}

describe('NotificationContent', () => {
  it.each(NOTIFICATION_TYPES)('renders %s with its label, time and unread marker', (type) => {
    render(<NotificationContent notification={{ ...base, type }} />)
    expect(screen.getByText(new RegExp(`^${NOTIFICATION_TYPE_LABELS[type]} ·`))).toBeInTheDocument()
    expect(screen.getByText(/25 Nov 2026/)).toBeInTheDocument()
    expect(screen.getByText('(unread)')).toBeInTheDocument()
    expect(screen.getByText('More detail')).toBeInTheDocument()
  })

  it('hides the body in compact mode and the marker once read', () => {
    render(
      <NotificationContent notification={{ ...base, type: 'announcement', read: true }} compact />,
    )
    expect(screen.queryByText('More detail')).not.toBeInTheDocument()
    expect(screen.queryByText('(unread)')).not.toBeInTheDocument()
  })
})
