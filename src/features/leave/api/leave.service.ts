// LeaveService and ApprovalService contracts (P5-T04). The backend is authoritative for routing,
// balances, the ledger and every rule (D-027); it must apply approvals in a transaction with row
// locking so a request is never deducted twice (D-069). Scope: own requests for everyone; requests
// you take part in; your reporting scope (D-044); HR sees all.
import type { Page } from '@/types/api'
import type {
  ActionInput,
  AllocationAdjustment,
  ApprovalTask,
  InboxTab,
  LeaveApplicationInput,
  LeaveBalance,
  LeaveListQuery,
  LeaveRequest,
  LeaveRequestDetail,
  LeaveSummary,
  LedgerEntry,
  RoutePreview,
} from '../schemas/leave.schema'

type Options = { signal?: AbortSignal }

export interface LeaveService {
  /** Balances for a leave year; `employeeId` other than your own is HR only. */
  getBalances(
    query: { employeeId?: string; year: number },
    options?: Options,
  ): Promise<LeaveBalance[]>
  getLedger(query: { employeeId?: string; year: number }, options?: Options): Promise<LedgerEntry[]>
  /** HR only: add or remove allocated days with a reason; creates a ledger entry. */
  adjustAllocation(input: AllocationAdjustment): Promise<LedgerEntry>
  /** Who would decide, review and be notified for your request (managers optionally chosen). */
  previewRoute(managerIds: readonly string[] | null, options?: Options): Promise<RoutePreview>
  listMine(options?: Options): Promise<LeaveRequest[]>
  /** 400 with field errors (dates, overlap, balance, attachment, managers). */
  submit(input: LeaveApplicationInput): Promise<LeaveRequestDetail>
  list(query: LeaveListQuery, options?: Options): Promise<Page<LeaveRequest>>
  get(id: string, options?: Options): Promise<LeaveRequestDetail>
  /** Requester only: pending, or approved until the day before the start (D-088). */
  cancel(id: string, input: { reason: string | null; version: number }): Promise<LeaveRequestDetail>
  getSummary(options?: Options): Promise<LeaveSummary>
}

export interface ApprovalService {
  inbox(tab: InboxTab, options?: Options): Promise<ApprovalTask[]>
  /**
   * Approve, decline, recommend, comment or (HR) override. 409 `already_decided` for a repeated
   * decision, 409 `conflict` when the request changed since `version`, 409 `insufficient_balance`.
   */
  act(id: string, input: ActionInput): Promise<LeaveRequestDetail>
}
