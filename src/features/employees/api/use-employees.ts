// TanStack Query hooks for employees. The list query key holds every server-side parameter
// (page, size, search, filters, ordering) so each combination is cached separately.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type { EmployeeInput, EmployeeListQuery, EmployeePatch } from '../schemas/employee.schema'
import type { EmployeeService } from './employee.service'

export const employeeKeys = {
  all: ['employees'] as const,
  list: (query: EmployeeListQuery) => ['employees', 'list', query] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
}

const svc = (service?: EmployeeService) => service ?? services.employees

export function useEmployeeList(query: EmployeeListQuery, service?: EmployeeService) {
  return useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: ({ signal }) => svc(service).list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useEmployee(id: string, service?: EmployeeService) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: ({ signal }) => svc(service).get(id, { signal }),
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
      // Headcounts, team members and reporting lines change with employees.
      queryClient.invalidateQueries({ queryKey: ['organization'] }),
    ])
}

export function useCreateEmployee(service?: EmployeeService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: EmployeeInput) => svc(service).create(input),
    onSuccess: refresh,
  })
}

export function useUpdateEmployee(service?: EmployeeService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EmployeePatch }) =>
      svc(service).update(id, patch),
    onSuccess: refresh,
  })
}

export function useSetEmployeeActive(service?: EmployeeService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, active, reason }: { id: string; active: boolean; reason?: string }) =>
      active ? svc(service).activate(id) : svc(service).deactivate(id, reason ?? ''),
    onSuccess: refresh,
  })
}
