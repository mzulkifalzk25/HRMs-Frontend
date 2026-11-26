// TanStack Query hooks for attendance. Check-in/out and corrections refresh every attendance
// query (today, history, team lists, summaries, dashboards).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type { AttendanceListQuery, CorrectionInput } from '../schemas/attendance.schema'
import type { AttendanceService } from './attendance.service'

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: ['attendance', 'today'] as const,
  mine: (from: string, to: string) => ['attendance', 'mine', from, to] as const,
  list: (query: AttendanceListQuery) => ['attendance', 'list', query] as const,
  record: (id: string) => ['attendance', 'record', id] as const,
  corrections: (id: string) => ['attendance', 'corrections', id] as const,
  summary: ['attendance', 'summary'] as const,
}

const svc = (service?: AttendanceService) => service ?? services.attendance

export function useTodayAttendance(service?: AttendanceService) {
  return useQuery({
    queryKey: attendanceKeys.today,
    queryFn: ({ signal }) => svc(service).getToday({ signal }),
  })
}

export function useMyAttendance(from: string, to: string, service?: AttendanceService) {
  return useQuery({
    queryKey: attendanceKeys.mine(from, to),
    queryFn: ({ signal }) => svc(service).listMine({ from, to }, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAttendanceList(query: AttendanceListQuery, service?: AttendanceService) {
  return useQuery({
    queryKey: attendanceKeys.list(query),
    queryFn: ({ signal }) => svc(service).list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAttendanceCorrections(id: string | null, service?: AttendanceService) {
  return useQuery({
    queryKey: attendanceKeys.corrections(id ?? ''),
    queryFn: ({ signal }) => svc(service).listCorrections(id ?? '', { signal }),
    enabled: Boolean(id),
  })
}

export function useAttendanceSummary(service?: AttendanceService) {
  return useQuery({
    queryKey: attendanceKeys.summary,
    queryFn: ({ signal }) => svc(service).getSummary({ signal }),
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
      // Attendance changes decide which reminders are due next (P6-T07).
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ])
}

/**
 * Check-in/out are never retried automatically (a retry could record twice); the server also
 * rejects duplicates with 409 (D-069-style safety, R-013).
 */
export function useCheckIn(service?: AttendanceService) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: () => svc(service).checkIn(), onSettled: refresh })
}

export function useCheckOut(service?: AttendanceService) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: () => svc(service).checkOut(), onSettled: refresh })
}

export function useCorrectAttendance(service?: AttendanceService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CorrectionInput }) =>
      svc(service).correct(id, input),
    onSuccess: refresh,
  })
}
