import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type { ReportFilters } from '../schemas/report.schema'

const options = { placeholderData: keepPreviousData } as const

export const useAttendanceReport = (f: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: ['reports', 'attendance', f],
    queryFn: ({ signal }) => services.reports.attendance(f, { signal }),
    enabled,
    ...options,
  })
export const useLeaveReport = (f: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: ['reports', 'leave', f],
    queryFn: ({ signal }) => services.reports.leave(f, { signal }),
    enabled,
    ...options,
  })
export const useEmployeeReport = (f: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: ['reports', 'employees', f],
    queryFn: ({ signal }) => services.reports.employees(f, { signal }),
    enabled,
    ...options,
  })
export const useDepartmentReport = (f: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: ['reports', 'departments', f],
    queryFn: ({ signal }) => services.reports.departments(f, { signal }),
    enabled,
    ...options,
  })
