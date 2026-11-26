import { describe, expect, it } from 'vitest'
import { routeLeaveRequest, type OrgContext, type OrgPerson } from './routing'

const person = (
  id: string,
  role: OrgPerson['role'],
  extra: Partial<OrgPerson> = {},
): OrgPerson => ({
  id,
  name: id.toUpperCase(),
  role,
  status: 'active',
  managerIds: [],
  teamIds: [],
  projectIds: [],
  ...extra,
})

function org(people: OrgPerson[]): OrgContext {
  return {
    people,
    teams: [
      { id: 't-1', teamLeadId: 'tl', status: 'active' },
      { id: 't-old', teamLeadId: 'tl2', status: 'inactive' },
    ],
    projects: [
      { id: 'p-1', seniorPmId: 'spm', associatePmId: 'apm', status: 'active' },
      { id: 'p-2', seniorPmId: null, associatePmId: 'apm2', status: 'active' },
    ],
  }
}

const base = [
  person('hr', 'hr_admin'),
  person('hr2', 'hr_admin'),
  person('mgr', 'manager'),
  person('mgr2', 'manager'),
  person('spm', 'senior_pm'),
  person('apm', 'associate_pm', { managerIds: ['spm'], projectIds: ['p-1'] }),
  person('apm2', 'associate_pm', { projectIds: ['p-2'] }),
  person('tl', 'team_lead', { managerIds: ['mgr'], teamIds: ['t-1'], projectIds: ['p-1'] }),
  person('tl2', 'team_lead'),
  person('emp', 'employee', { managerIds: ['mgr'], teamIds: ['t-1'], projectIds: ['p-1'] }),
  person('multi', 'employee', { managerIds: ['mgr', 'mgr2'], teamIds: ['t-1', 't-old'] }),
  person('solo', 'employee'),
  person('gone-mgr', 'employee', { managerIds: ['old'] }),
  person('old', 'manager', { status: 'inactive' }),
]

describe('leave routing (D-066, D-089)', () => {
  it('employee → their manager; Team Lead and Associate PM review; HR always notified', () => {
    const route = routeLeaveRequest('emp', org(base))
    expect(route).toMatchObject({
      target: 'managers',
      deciderIds: ['mgr'],
      reviewerIds: ['tl', 'apm'],
      mandatoryRecipientIds: ['hr', 'hr2'],
      problem: null,
    })
  })

  it('several managers: all offered; the selection decides (any one decides, D-089)', () => {
    const all = routeLeaveRequest('multi', org(base))
    expect(all.managerChoices.map((m) => m.id)).toEqual(['mgr', 'mgr2'])
    expect(all.deciderIds).toEqual(['mgr', 'mgr2'])
    expect(routeLeaveRequest('multi', org(base), ['mgr2']).deciderIds).toEqual(['mgr2'])
    // inactive team's lead is not a reviewer
    expect(all.reviewerIds).toEqual(['tl'])
  })

  it('an empty selection is a problem, not a silent route', () => {
    expect(routeLeaveRequest('multi', org(base), []).problem).toBe('Choose at least one manager.')
    expect(routeLeaveRequest('multi', org(base), ['stranger']).deciderIds).toEqual([])
  })

  it.each([
    ['solo', 'no manager'],
    ['gone-mgr', 'only an inactive manager'],
    ['mgr', 'Manager'],
    ['spm', 'Senior PM'],
  ])('%s (%s) → HR', (id) => {
    const route = routeLeaveRequest(id, org(base))
    expect(route.target).toBe('hr')
    expect(route.deciderIds).toEqual(['hr', 'hr2'])
    expect(route.reviewerIds).toEqual([])
  })

  it('Team Lead → their own manager, never reviewing themselves', () => {
    const route = routeLeaveRequest('tl', org(base))
    expect(route.target).toBe('managers')
    expect(route.deciderIds).toEqual(['mgr'])
    expect(route.reviewerIds).toEqual(['apm'])
  })

  it('Associate PM → the Senior PM of their projects; HR when there is none (D-090)', () => {
    expect(routeLeaveRequest('apm', org(base))).toMatchObject({
      target: 'senior_pm',
      deciderIds: ['spm'],
    })
    expect(routeLeaveRequest('apm2', org(base))).toMatchObject({
      target: 'hr',
      deciderIds: ['hr', 'hr2'],
    })
  })

  it('HR Administrator → another HR Administrator, never themselves', () => {
    const route = routeLeaveRequest('hr', org(base))
    expect(route.deciderIds).toEqual(['hr2'])
    expect(route.mandatoryRecipientIds).toEqual(['hr2'])
    const alone = routeLeaveRequest('hr', org(base.filter((p) => p.id !== 'hr2')))
    expect(alone.deciderIds).toEqual([])
    expect(alone.problem).toMatch(/no other HR Administrator/)
  })

  it('nobody decides or reviews their own request', () => {
    for (const p of base) {
      const route = routeLeaveRequest(p.id, org(base))
      expect(route.deciderIds).not.toContain(p.id)
      expect(route.reviewerIds).not.toContain(p.id)
    }
  })
})
