// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { House } from 'lucide-react'
import { ROLES } from '@/features/authentication'
import { navigationForRole, type NavSection } from './navigation'

describe('navigationForRole', () => {
  it.each(ROLES)('%s sees their own dashboard and profile, nothing unbuilt', (role) => {
    const items = navigationForRole(role).flatMap((section) => section.items)
    expect(items.map((item) => item.label)).toEqual(['Dashboard', 'My profile'])
    expect(items[0]?.to).toMatch(/^\/dashboard\//)
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
