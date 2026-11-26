import { describe, expect, it } from 'vitest'
import {
  audienceLabel,
  isAnnouncementActive,
  reaches,
  type AudiencePerson,
} from './announcement-rules'

const person = (extra: Partial<AudiencePerson> = {}): AudiencePerson => ({
  id: 'e-1',
  status: 'active',
  departmentId: 'd-eng',
  teamIds: ['t-fe'],
  ...extra,
})

describe('announcement audience (D-093)', () => {
  it.each([
    [{ kind: 'everyone' as const, ids: [] }, person(), true],
    [{ kind: 'departments' as const, ids: ['d-eng', 'd-hr'] }, person(), true],
    [{ kind: 'departments' as const, ids: ['d-hr'] }, person(), false],
    [{ kind: 'departments' as const, ids: ['d-hr'] }, person({ departmentId: null }), false],
    [{ kind: 'teams' as const, ids: ['t-be', 't-fe'] }, person(), true],
    [{ kind: 'teams' as const, ids: ['t-be'] }, person(), false],
    [{ kind: 'everyone' as const, ids: [] }, person({ status: 'inactive' }), false],
    [{ kind: 'everyone' as const, ids: [] }, person({ status: 'invited' }), false],
  ])('%o reaches %o: %s', (audience, p, expected) => {
    expect(reaches(audience, p)).toBe(expected)
  })

  it('stays until archived, or through its expiry date', () => {
    expect(isAnnouncementActive({ archived: false, expiresOn: null }, '2030-01-01')).toBe(true)
    expect(isAnnouncementActive({ archived: false, expiresOn: '2026-11-25' }, '2026-11-25')).toBe(
      true,
    )
    expect(isAnnouncementActive({ archived: false, expiresOn: '2026-11-25' }, '2026-11-26')).toBe(
      false,
    )
    expect(isAnnouncementActive({ archived: true, expiresOn: null }, '2026-11-25')).toBe(false)
  })

  it('labels the audience with names', () => {
    const names = new Map([
      ['d-eng', 'Engineering'],
      ['t-fe', 'Frontend'],
    ])
    expect(audienceLabel({ kind: 'everyone', ids: [] }, names)).toBe('Everyone')
    expect(audienceLabel({ kind: 'departments', ids: ['d-eng'] }, names)).toBe(
      'Departments: Engineering',
    )
    expect(audienceLabel({ kind: 'teams', ids: ['t-fe', 't-x'] }, names)).toBe(
      'Teams: Frontend, t-x',
    )
  })
})
