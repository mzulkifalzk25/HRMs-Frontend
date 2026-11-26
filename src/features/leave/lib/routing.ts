// Leave routing (P5-T07; D-064, D-066, D-089). Pure: given the organization, decides who decides
// a request, who may review it and who is always notified. The backend runs the same rules and is
// authoritative; the frontend uses this for the mock backend and for tests.
//
//   Employee / Team Lead with manager(s) → the selected manager(s); any one decides (D-089)
//   Employee / Team Lead without manager  → HR (D-066)
//   Manager                               → HR (D-066)
//   Senior PM                             → HR (D-089)
//   Associate PM                          → Senior PM of their projects (D-066); HR if none (D-090)
//   HR Administrator                      → another HR Administrator, never themselves (D-089)
//
// Optional reviewers (requests routed to managers only): the Team Lead of the requester's teams
// and the Associate PM of the requester's projects (D-089). HR Administrators are always notified
// and cannot be removed (D-064). Nobody ever reviews or decides their own request (D-068).
import type { Role } from '@/features/authentication/types'

export type OrgPerson = {
  id: string
  name: string
  role: Role
  status: 'invited' | 'active' | 'inactive'
  managerIds: readonly string[]
  teamIds: readonly string[]
  projectIds: readonly string[]
}

export type OrgContext = {
  people: readonly OrgPerson[]
  teams: ReadonlyArray<{ id: string; teamLeadId: string | null; status: 'active' | 'inactive' }>
  projects: ReadonlyArray<{
    id: string
    seniorPmId: string | null
    associatePmId: string | null
    status: 'active' | 'inactive'
  }>
}

export const ROUTE_TARGETS = ['managers', 'hr', 'senior_pm'] as const
export type RouteTarget = (typeof ROUTE_TARGETS)[number]

export type LeaveRoute = {
  target: RouteTarget
  /** Managers the requester may choose from (only when target is `managers`). */
  managerChoices: Array<{ id: string; name: string }>
  /** People any one of whom makes the final decision (D-089). */
  deciderIds: string[]
  /** Optional reviewers: comment and recommend, never block (D-089). */
  reviewerIds: string[]
  /** Always notified and not removable: HR Administrators (D-064). */
  mandatoryRecipientIds: string[]
  /** Why the request cannot be submitted, or null. */
  problem: string | null
}

const unique = (ids: Iterable<string>) => [...new Set(ids)]

export function routeLeaveRequest(
  requesterId: string,
  org: OrgContext,
  selectedManagerIds?: readonly string[],
): LeaveRoute {
  const byId = new Map(org.people.map((p) => [p.id, p]))
  const active = (id: string | null | undefined): id is string =>
    Boolean(id) && byId.get(id as string)?.status === 'active' && id !== requesterId
  const requester = byId.get(requesterId)
  const hrAdmins = org.people.filter((p) => p.role === 'hr_admin' && p.status === 'active')
  const mandatoryRecipientIds = hrAdmins.map((p) => p.id).filter((id) => id !== requesterId)
  const base = { managerChoices: [], reviewerIds: [], mandatoryRecipientIds, problem: null }

  if (!requester) {
    return { ...base, target: 'hr', deciderIds: [], problem: 'Your employee record was not found.' }
  }

  const toHr = (): LeaveRoute => {
    const deciderIds = hrAdmins.map((p) => p.id).filter((id) => id !== requesterId)
    return {
      ...base,
      target: 'hr',
      deciderIds,
      problem:
        deciderIds.length === 0
          ? 'There is no other HR Administrator who can decide this request. Ask the system owner to add one.'
          : null,
    }
  }

  switch (requester.role) {
    case 'hr_admin':
    case 'manager':
    case 'senior_pm':
      return toHr()
    case 'associate_pm': {
      const seniorPms = unique(
        org.projects
          .filter((p) => p.status === 'active' && p.associatePmId === requesterId)
          .map((p) => p.seniorPmId)
          .filter(active),
      )
      return seniorPms.length > 0 ? { ...base, target: 'senior_pm', deciderIds: seniorPms } : toHr()
    }
    case 'employee':
    case 'team_lead': {
      const managers = requester.managerIds.filter(active)
      if (managers.length === 0) return toHr()
      const managerChoices = managers.map((id) => ({ id, name: byId.get(id)?.name ?? id }))
      const deciderIds = selectedManagerIds
        ? managers.filter((id) => selectedManagerIds.includes(id))
        : managers
      const teams = new Set(requester.teamIds)
      const projects = new Set(requester.projectIds)
      const reviewerIds = unique([
        ...org.teams
          .filter((t) => t.status === 'active' && teams.has(t.id))
          .map((t) => t.teamLeadId)
          .filter(active),
        ...org.projects
          .filter((p) => p.status === 'active' && projects.has(p.id))
          .map((p) => p.associatePmId)
          .filter(active),
      ]).filter((id) => !deciderIds.includes(id))
      return {
        ...base,
        target: 'managers',
        managerChoices,
        deciderIds,
        reviewerIds,
        problem: deciderIds.length === 0 ? 'Choose at least one manager.' : null,
      }
    }
  }
}
