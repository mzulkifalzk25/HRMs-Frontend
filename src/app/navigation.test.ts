// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { House } from 'lucide-react'
import { ROLES } from '@/features/authentication'
import { navigationForRole, type NavSection } from './navigation'

describe('navigationForRole', () => {
  const EXPECTED: Record<(typeof ROLES)[number], string[]> = {
    hr_admin: [
      'Dashboard',
      'Employees',
      'My attendance',
      'Attendance records',
      'My leave',
      'Approvals',
      'Leave records',
      'Reports',
      'Org chart',
      'Announcements',
      'Organization',
      'Leave balances',
      'Imports',
      'Settings',
      'Audit log',
      'Notifications',
      'My profile',
    ],
    manager: [
      'Dashboard',
      'Employees',
      'My attendance',
      'Attendance records',
      'My leave',
      'Approvals',
      'Leave records',
      'Reports',
      'Org chart',
      'Announcements',
      'Notifications',
      'My profile',
    ],
    senior_pm: [
      'Dashboard',
      'Employees',
      'My attendance',
      'Attendance records',
      'My leave',
      'Approvals',
      'Leave records',
      'Reports',
      'Org chart',
      'Announcements',
      'Notifications',
      'My profile',
    ],
    associate_pm: [
      'Dashboard',
      'Employees',
      'My attendance',
      'Attendance records',
      'My leave',
      'Approvals',
      'Leave records',
      'Reports',
      'Org chart',
      'Announcements',
      'Notifications',
      'My profile',
    ],
    team_lead: [
      'Dashboard',
      'Employees',
      'My attendance',
      'Attendance records',
      'My leave',
      'Approvals',
      'Leave records',
      'Reports',
      'Org chart',
      'Announcements',
      'Notifications',
      'My profile',
    ],
    // Employees have no directory or team records: only their own data (D-044).
    employee: [
      'Dashboard',
      'My attendance',
      'My leave',
      'Org chart',
      'Announcements',
      'Notifications',
      'My profile',
    ],
  }

  it.each(ROLES)('%s sees only the modules that exist for their role', (role) => {
    const items = navigationForRole(role).flatMap((section) => section.items)
    expect(items.map((item) => item.label)).toEqual(EXPECTED[role])
    expect(items[0]?.to).toMatch(/^\/dashboard\//)
  })

  it('shows the Administration section to HR only', () => {
    expect(navigationForRole('hr_admin').map((s) => s.title)).toContain('Administration')
    expect(navigationForRole('manager').map((s) => s.title)).not.toContain('Administration')
  })

  it('filters by role and drops empty sections', () => {
    const sections: NavSection[] = [
      {
        title: 'HR',
        items: [{ label: 'Imports', icon: House, to: '/imports', roles: ['hr_admin'] }],
      },
      { title: 'All', items: [{ label: 'Home', icon: House, to: '/', roles: ROLES }] },
    ]
    expect(navigationForRole('hr_admin', sections).map((s) => s.title)).toEqual(['HR', 'All'])
    expect(navigationForRole('employee', sections).map((s) => s.title)).toEqual(['All'])
  })
})
