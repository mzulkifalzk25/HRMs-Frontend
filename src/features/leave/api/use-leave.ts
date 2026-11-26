// TanStack Query hooks for leave and approvals. Every write refreshes all leave queries (balances,
// ledger, lists, inbox, summaries, dashboards) and the attendance summary ("on leave" count).
// Writes are never retried automatically: the server rejects duplicates (409, D-069).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type {
  ActionInput,
  AllocationAdjustment,
  InboxTab,
  LeaveApplicationInput,
  LeaveListQuery,
} from '../schemas/leave.schema'
import type { ApprovalService, LeaveService } from './leave.service'

export const leaveKeys = {
  all: ['leave'] as const,
  balances: (employeeId: string | null, year: number) =>
    ['leave', 'balances', employeeId, year] as const,
  ledger: (employeeId: string | null, year: number) =>
    ['leave', 'ledger', employeeId, year] as const,
  route: (managerIds: readonly string[] | null) => ['leave', 'route', managerIds] as const,
  mine: ['leave', 'mine'] as const,
  list: (query: LeaveListQuery) => ['leave', 'list', query] as const,
  request: (id: string) => ['leave', 'request', id] as const,
  inbox: (tab: InboxTab) => ['leave', 'inbox', tab] as const,
  summary: ['leave', 'summary'] as const,
}

const leave = (service?: LeaveService) => service ?? services.leave
const approvals = (service?: ApprovalService) => service ?? services.approvals

export function useLeaveBalances(employeeId: string | null, year: number, service?: LeaveService) {
  return useQuery({
    queryKey: leaveKeys.balances(employeeId, year),
    queryFn: ({ signal }) =>
      leave(service).getBalances({ employeeId: employeeId ?? undefined, year }, { signal }),
  })
}

export function useLeaveLedger(employeeId: string | null, year: number, service?: LeaveService) {
  return useQuery({
    queryKey: leaveKeys.ledger(employeeId, year),
    queryFn: ({ signal }) =>
      leave(service).getLedger({ employeeId: employeeId ?? undefined, year }, { signal }),
  })
}

export function useRoutePreview(managerIds: readonly string[] | null, service?: LeaveService) {
  return useQuery({
    queryKey: leaveKeys.route(managerIds),
    queryFn: ({ signal }) => leave(service).previewRoute(managerIds, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useMyLeaveRequests(service?: LeaveService) {
  return useQuery({
    queryKey: leaveKeys.mine,
    queryFn: ({ signal }) => leave(service).listMine({ signal }),
  })
}

export function useLeaveList(query: LeaveListQuery, service?: LeaveService) {
  return useQuery({
    queryKey: leaveKeys.list(query),
    queryFn: ({ signal }) => leave(service).list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useLeaveRequest(id: string, service?: LeaveService) {
  return useQuery({
    queryKey: leaveKeys.request(id),
    queryFn: ({ signal }) => leave(service).get(id, { signal }),
  })
}

export function useApprovalInbox(tab: InboxTab, service?: ApprovalService) {
  return useQuery({
    queryKey: leaveKeys.inbox(tab),
    queryFn: ({ signal }) => approvals(service).inbox(tab, { signal }),
  })
}

export function useLeaveSummary(service?: LeaveService) {
  return useQuery({
    queryKey: leaveKeys.summary,
    queryFn: ({ signal }) => leave(service).getSummary({ signal }),
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: leaveKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['attendance', 'summary'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ])
}

export function useSubmitLeave(service?: LeaveService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: LeaveApplicationInput) => leave(service).submit(input),
    onSuccess: refresh,
  })
}

/** Refreshes on errors too: a 409 means the request changed and the latest version is shown. */
export function useLeaveAction(service?: ApprovalService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActionInput }) =>
      approvals(service).act(id, input),
    onSettled: refresh,
  })
}

export function useCancelLeave(service?: LeaveService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, reason, version }: { id: string; reason: string | null; version: number }) =>
      leave(service).cancel(id, { reason, version }),
    onSettled: refresh,
  })
}

export function useAdjustAllocation(service?: LeaveService) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: AllocationAdjustment) => leave(service).adjustAllocation(input),
    onSuccess: refresh,
  })
}
