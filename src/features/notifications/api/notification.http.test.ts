// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '@/services/api'
import { createHttpAnnouncementService, createHttpNotificationService } from './notification.http'

const notification = {
  id: 'n-1',
  type: 'leave_approved',
  title: 'Your Casual leave was approved',
  body: null,
  link: '/leave/requests/lr-1',
  actor_name: 'Imran Demo',
  created_at: '2026-11-25T10:00:00.000+05:00',
  read: false,
}

function client(response: unknown) {
  const call = vi.fn(async () => response)
  return {
    call,
    client: {
      get: call,
      post: call,
      put: call,
      patch: call,
      delete: call,
    } as unknown as HttpClient,
  }
}

describe('HTTP notification service', () => {
  it('lists with snake_case filters and camelizes the result', async () => {
    const { client: c, call } = client({
      count: 1,
      next: null,
      previous: null,
      results: [notification],
    })
    const page = await createHttpNotificationService(c).list({
      page: 2,
      pageSize: 10,
      status: 'unread',
    })
    expect(call).toHaveBeenCalledWith('notifications/', {
      signal: undefined,
      query: {
        page: 2,
        page_size: 10,
        type: undefined,
        status: 'unread',
        from: undefined,
        to: undefined,
      },
    })
    expect(page.results[0]).toMatchObject({
      actorName: 'Imran Demo',
      createdAt: notification.created_at,
    })
  })

  it('rejects responses that break the contract', async () => {
    const { client: c } = client({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...notification, type: 'party' }],
    })
    await expect(createHttpNotificationService(c).list({ page: 1, pageSize: 10 })).rejects.toThrow()
  })

  it('sends announcements with expires_on', async () => {
    const { client: c, call } = client({
      id: 'an-1',
      title: 'Office closed',
      body: 'The office is closed on Friday.',
      audience: { kind: 'everyone', ids: [] },
      audience_label: 'Everyone',
      author_name: 'Sana Demo',
      created_at: '2026-11-25T10:00:00.000+05:00',
      expires_on: '2026-11-28',
      archived: false,
    })
    const created = await createHttpAnnouncementService(c).create({
      title: 'Office closed',
      body: 'The office is closed on Friday.',
      audience: { kind: 'everyone', ids: [] },
      expiresOn: '2026-11-28',
    })
    expect(call).toHaveBeenCalledWith('announcements/', {
      title: 'Office closed',
      body: 'The office is closed on Friday.',
      audience: { kind: 'everyone', ids: [] },
      expires_on: '2026-11-28',
    })
    expect(created.expiresOn).toBe('2026-11-28')
  })
})
