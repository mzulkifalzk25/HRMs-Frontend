// Notification and announcement contracts (P6-T01, P6-T08). The API sends snake_case (camelized
// by the client). Notifications are created by the backend from events; the app only lists them,
// marks them read and edits preferences (D-093: in-app only).
import { z } from 'zod'
import { dateKeySchema, instantSchema } from '@/types/hr'
import { MUTABLE_NOTIFICATION_TYPES, NOTIFICATION_TYPES } from '../lib/notification-types'

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES)

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string().nullable(),
  /** In-app path of the related item (leave request, attendance, announcement). */
  link: z.string().nullable(),
  actorName: z.string().nullable(),
  createdAt: instantSchema,
  read: z.boolean(),
})
export type Notification = z.infer<typeof notificationSchema>

export const unreadCountSchema = z.object({ count: z.number().int().nonnegative() })

export const notificationPreferencesSchema = z.object({
  muted: z.array(z.enum(MUTABLE_NOTIFICATION_TYPES)),
})
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>

export type NotificationListQuery = {
  page: number
  pageSize: number
  type?: Notification['type']
  status?: 'read' | 'unread'
  /** Created on or after / on or before these Pakistan dates. */
  from?: string
  to?: string
}

// --- Announcements ------------------------------------------------------------------------------

export const AUDIENCE_KINDS = ['everyone', 'departments', 'teams'] as const
export const audienceSchema = z.object({
  kind: z.enum(AUDIENCE_KINDS),
  /** Department or team ids; empty for everyone. */
  ids: z.array(z.string()),
})
export type Audience = z.infer<typeof audienceSchema>

export const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  audience: audienceSchema,
  /** Readable audience, e.g. "Everyone" or "Engineering, Design". */
  audienceLabel: z.string(),
  authorName: z.string(),
  createdAt: instantSchema,
  /** Last day it is shown (Pakistan date), or null to stay until archived (D-093). */
  expiresOn: dateKeySchema.nullable(),
  archived: z.boolean(),
})
export type Announcement = z.infer<typeof announcementSchema>

export type AnnouncementInput = {
  title: string
  body: string
  audience: Audience
  expiresOn: string | null
}

export const ANNOUNCEMENT_LIMITS = { titleMax: 120, bodyMax: 2000, titleMin: 3, bodyMin: 5 }

/** HR announcement form (P6-T08). `today` is the Pakistan date; expiry cannot be in the past. */
export const announcementFormSchema = (today: string) =>
  z
    .object({
      title: z.string(),
      body: z.string(),
      audienceKind: z.enum(AUDIENCE_KINDS),
      audienceIds: z.array(z.string()),
      expiresOn: z.string(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })
      const { titleMin, titleMax, bodyMin, bodyMax } = ANNOUNCEMENT_LIMITS
      const title = v.title.trim()
      const body = v.body.trim()
      if (title.length < titleMin || title.length > titleMax)
        issue('title', `Use ${titleMin} to ${titleMax} characters.`)
      if (body.length < bodyMin || body.length > bodyMax)
        issue('body', `Use ${bodyMin} to ${bodyMax} characters.`)
      if (v.audienceKind !== 'everyone' && v.audienceIds.length === 0)
        issue(
          'audienceIds',
          `Choose at least one ${v.audienceKind === 'teams' ? 'team' : 'department'}.`,
        )
      if (v.expiresOn && v.expiresOn < today)
        issue('expiresOn', 'The expiry date cannot be in the past.')
    })
    .transform((v): AnnouncementInput => ({
      title: v.title.trim(),
      body: v.body.trim(),
      audience: { kind: v.audienceKind, ids: v.audienceKind === 'everyone' ? [] : v.audienceIds },
      expiresOn: v.expiresOn || null,
    }))
export type AnnouncementFormValues = z.input<ReturnType<typeof announcementFormSchema>>
