// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ROLES } from '../types'
import {
  DASHBOARD_PATHS,
  dashboardPathForRole,
  postLoginPath,
  safeRedirectPath,
} from './role-routes'

describe('dashboardPathForRole', () => {
  it('gives every role its own dashboard path', () => {
    const paths = ROLES.map(dashboardPathForRole)
    expect(new Set(paths).size).toBe(ROLES.length)
    expect(dashboardPathForRole('hr_admin')).toBe('/dashboard/hr')
    expect(dashboardPathForRole('employee')).toBe('/dashboard/employee')
    expect(Object.keys(DASHBOARD_PATHS).sort()).toEqual([...ROLES].sort())
  })
})

describe('safeRedirectPath (open-redirect protection)', () => {
  it.each([
    ['/profile', '/profile'],
    ['/dashboard/hr?tab=leave#top', '/dashboard/hr?tab=leave#top'],
    ['/a/../profile', '/profile'],
  ])('allows internal path %j', (value, expected) => {
    expect(safeRedirectPath(value)).toBe(expected)
  })

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example',
    'javascript:alert(1)',
    'profile',
    '/login',
    '/login?redirect=/profile',
    '/forgot-password',
    '/reset-password?token=x',
    '/invite?token=x',
    '/\tevil',
    '',
    null,
    undefined,
  ])('rejects %j', (value) => {
    expect(safeRedirectPath(value)).toBeNull()
  })
})

describe('postLoginPath', () => {
  it('uses a safe requested path, otherwise the role dashboard', () => {
    expect(postLoginPath('manager', '/profile')).toBe('/profile')
    expect(postLoginPath('manager', 'https://evil.example')).toBe('/dashboard/manager')
    expect(postLoginPath('team_lead', null)).toBe('/dashboard/team-lead')
  })
})
