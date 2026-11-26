// HTTP NotificationService / AnnouncementService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { z } from 'zod'
import { parseApiResponse, type HttpClient } from '@/services/api'
import { pageSchema } from '@/types/api'
import {
  announcementSchema,
  notificationPreferencesSchema,
  notificationSchema,
  unreadCountSchema,
} from '../schemas/notification.schema'
import type { AnnouncementService, NotificationService } from './notification.service'

const item = (id: string, action = '') =>
  `notifications/${encodeURIComponent(id)}/${action ? `${action}/` : ''}`

export function createHttpNotificationService(client: HttpClient): NotificationService {
  return {
    async list(query, { signal } = {}) {
      const body = await client.get('notifications/', {
        signal,
        query: {
          page: query.page,
          page_size: query.pageSize,
          type: query.type,
          status: query.status,
          from: query.from,
          to: query.to,
        },
      })
      return parseApiResponse(pageSchema(notificationSchema), body)
    },
    async unreadCount({ signal } = {}) {
      const body = await client.get('notifications/unread-count/', { signal })
      return parseApiResponse(unreadCountSchema, body).count
    },
    async markRead(id) {
      return parseApiResponse(notificationSchema, await client.post(item(id, 'read')))
    },
    async markAllRead() {
      const body = await client.post('notifications/read-all/')
      return parseApiResponse(z.object({ updated: z.number().int().nonnegative() }), body).updated
    },
    async getPreferences({ signal } = {}) {
      const body = await client.get('notifications/preferences/', { signal })
      return parseApiResponse(notificationPreferencesSchema, body)
    },
    async updatePreferences(preferences) {
      const body = await client.put('notifications/preferences/', { muted: preferences.muted })
      return parseApiResponse(notificationPreferencesSchema, body)
    },
  }
}

export function createHttpAnnouncementService(client: HttpClient): AnnouncementService {
  return {
    async list({ includeInactive }, { signal } = {}) {
      const body = await client.get('announcements/', {
        signal,
        query: includeInactive ? { include_inactive: true } : undefined,
      })
      return parseApiResponse(z.array(announcementSchema), body)
    },
    async create(input) {
      const body = await client.post('announcements/', {
        title: input.title,
        body: input.body,
        audience: { kind: input.audience.kind, ids: input.audience.ids },
        expires_on: input.expiresOn,
      })
      return parseApiResponse(announcementSchema, body)
    },
    async archive(id) {
      const body = await client.post(`announcements/${encodeURIComponent(id)}/archive/`)
      return parseApiResponse(announcementSchema, body)
    },
  }
}
