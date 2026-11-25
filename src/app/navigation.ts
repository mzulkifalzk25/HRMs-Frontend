// Sidebar navigation (P1-T14). Static and role-agnostic for now; role-aware filtering is P2-T11.
// Modules that do not exist yet are listed as "planned" (not links), so nothing leads to a dead page.
import {
  Bell,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  Clock,
  FileUp,
  LayoutDashboard,
  Network,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem =
  | { label: string; icon: LucideIcon; status: 'available'; to: string }
  | { label: string; icon: LucideIcon; status: 'planned'; phase: number }

export type NavSection = { title: string; items: NavItem[] }

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [{ label: 'Overview', icon: LayoutDashboard, status: 'available', to: '/' }],
  },
  {
    title: 'Planned modules',
    items: [
      { label: 'Employees', icon: Users, status: 'planned', phase: 3 },
      { label: 'Organization', icon: Network, status: 'planned', phase: 3 },
      { label: 'Attendance', icon: Clock, status: 'planned', phase: 4 },
      { label: 'Leave', icon: CalendarDays, status: 'planned', phase: 5 },
      { label: 'Approvals', icon: ClipboardCheck, status: 'planned', phase: 5 },
      { label: 'Notifications', icon: Bell, status: 'planned', phase: 6 },
      { label: 'Imports', icon: FileUp, status: 'planned', phase: 7 },
      { label: 'Reports', icon: ChartColumn, status: 'planned', phase: 8 },
      { label: 'Audit log', icon: ScrollText, status: 'planned', phase: 8 },
      { label: 'Settings', icon: Settings, status: 'planned', phase: 8 },
    ],
  },
]
