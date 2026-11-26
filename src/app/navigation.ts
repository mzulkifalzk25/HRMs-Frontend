// Sidebar navigation (P2-T11). Role-aware and limited to modules that exist: items for modules
// that are not built yet are hidden, never dead links. Add items here as later phases ship them.
// Visibility is UX only; the backend decides what each role may access (D-027).
import {
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileUp,
  Clock,
  Bell,
  ListChecks,
  Megaphone,
  Scale,
  LayoutDashboard,
  Network,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { dashboardPathForRole, ROLES, type Role } from '@/features/authentication'

export type NavItem = {
  label: string
  icon: LucideIcon
  /** Static path, or a function of the role (e.g. each role's dashboard). */
  to: string | ((role: Role) => string)
  roles: readonly Role[]
  /** Match the path exactly (no child routes). */
  end?: boolean
}

export type NavSection = { title: string; items: NavItem[] }

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        to: dashboardPathForRole,
        roles: ROLES,
        end: true,
      },
      {
        label: 'Employees',
        icon: Users,
        to: '/employees',
        roles: ['hr_admin', 'manager', 'senior_pm', 'associate_pm', 'team_lead'],
      },
      { label: 'My attendance', icon: Clock, to: '/attendance', roles: ROLES, end: true },
      {
        label: 'Attendance records',
        icon: ClipboardList,
        to: '/attendance/records',
        roles: ['hr_admin', 'manager', 'senior_pm', 'associate_pm', 'team_lead'],
      },
      { label: 'My leave', icon: CalendarDays, to: '/leave', roles: ROLES, end: true },
      {
        label: 'Approvals',
        icon: ListChecks,
        to: '/leave/approvals',
        roles: ['hr_admin', 'manager', 'senior_pm', 'associate_pm', 'team_lead'],
      },
      {
        label: 'Leave records',
        icon: CalendarRange,
        to: '/leave/records',
        roles: ['hr_admin', 'manager', 'senior_pm', 'associate_pm', 'team_lead'],
      },
      { label: 'Org chart', icon: Network, to: '/organization/chart', roles: ROLES },
      { label: 'Announcements', icon: Megaphone, to: '/announcements', roles: ROLES },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Organization',
        icon: Building2,
        to: '/organization',
        roles: ['hr_admin'],
        end: true,
      },
      { label: 'Leave balances', icon: Scale, to: '/leave/balances', roles: ['hr_admin'] },
      { label: 'Imports', icon: FileUp, to: '/imports', roles: ['hr_admin'] },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Notifications', icon: Bell, to: '/notifications', roles: ROLES },
      { label: 'My profile', icon: UserRound, to: '/profile', roles: ROLES, end: true },
    ],
  },
]

export type ResolvedNavItem = { label: string; icon: LucideIcon; to: string; end: boolean }
export type ResolvedNavSection = { title: string; items: ResolvedNavItem[] }

/** Sections and items visible to a role; empty sections are dropped. */
export function navigationForRole(
  role: Role,
  sections: NavSection[] = NAV_SECTIONS,
): ResolvedNavSection[] {
  return sections
    .map((section) => ({
      title: section.title,
      items: section.items
        .filter((item) => item.roles.includes(role))
        .map((item) => ({
          label: item.label,
          icon: item.icon,
          to: typeof item.to === 'function' ? item.to(role) : item.to,
          end: item.end ?? false,
        })),
    }))
    .filter((section) => section.items.length > 0)
}
