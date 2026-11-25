// TanStack Query hooks for the role dashboards. Keys include the role so data never leaks between
// sessions; the cache is also cleared on login and logout.
import { useQuery } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type { DashboardService } from './dashboard.service'

const key = (role: string) => ['dashboard', role] as const

export function useHrDashboard(service: DashboardService = services.dashboard) {
  return useQuery({
    queryKey: key('hr'),
    queryFn: ({ signal }) => service.getHrDashboard({ signal }),
  })
}

export function useManagerDashboard(service: DashboardService = services.dashboard) {
  return useQuery({
    queryKey: key('manager'),
    queryFn: ({ signal }) => service.getManagerDashboard({ signal }),
  })
}

export function useSeniorPmDashboard(service: DashboardService = services.dashboard) {
  return useQuery({
    queryKey: key('senior-pm'),
    queryFn: ({ signal }) => service.getSeniorPmDashboard({ signal }),
  })
}

export function useAssociatePmDashboard(service: DashboardService = services.dashboard) {
  return useQuery({
    queryKey: key('associate-pm'),
    queryFn: ({ signal }) => service.getAssociatePmDashboard({ signal }),
  })
}

export function useTeamLeadDashboard(service: DashboardService = services.dashboard) {
  return useQuery({
    queryKey: key('team-lead'),
    queryFn: ({ signal }) => service.getTeamLeadDashboard({ signal }),
  })
}

export function useEmployeeDashboard(service: DashboardService = services.dashboard) {
  return useQuery({
    queryKey: key('employee'),
    queryFn: ({ signal }) => service.getEmployeeDashboard({ signal }),
  })
}
