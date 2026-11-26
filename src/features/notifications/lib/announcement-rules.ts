// HR announcements (P6-T08, D-093): who an announcement reaches and whether it is still shown.
// Pure; the backend applies the same rules.
import type { Audience } from '../schemas/notification.schema'

export type AudiencePerson = {
  id: string
  status: 'invited' | 'active' | 'inactive'
  departmentId: string | null
  teamIds: readonly string[]
}

/** Everyone, people in one of the departments, or people in one of the teams. Active only. */
export function reaches(audience: Audience, person: AudiencePerson): boolean {
  if (person.status !== 'active') return false
  switch (audience.kind) {
    case 'everyone':
      return true
    case 'departments':
      return person.departmentId !== null && audience.ids.includes(person.departmentId)
    case 'teams':
      return person.teamIds.some((t) => audience.ids.includes(t))
  }
}

/** Shown until archived, and through its expiry date (inclusive) when it has one. */
export function isAnnouncementActive(
  announcement: { archived: boolean; expiresOn: string | null },
  today: string,
): boolean {
  return (
    !announcement.archived && (announcement.expiresOn === null || today <= announcement.expiresOn)
  )
}

export function audienceLabel(audience: Audience, names: ReadonlyMap<string, string>): string {
  if (audience.kind === 'everyone') return 'Everyone'
  const list = audience.ids.map((id) => names.get(id) ?? id).join(', ')
  return audience.kind === 'departments' ? `Departments: ${list}` : `Teams: ${list}`
}
