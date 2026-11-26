// HTTP LeaveService / ApprovalService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { z } from 'zod'
import { parseApiResponse, type HttpClient } from '@/services/api'
import { pageSchema } from '@/types/api'
import {
  approvalTaskSchema,
  leaveBalanceSchema,
  leaveRequestDetailSchema,
  leaveRequestSchema,
  leaveSummarySchema,
  ledgerEntrySchema,
  routePreviewSchema,
} from '../schemas/leave.schema'
import type { ApprovalService, LeaveService } from './leave.service'

const requestPath = (id: string, action = '') =>
  `leave/requests/${encodeURIComponent(id)}/${action ? `${action}/` : ''}`

export function createHttpLeaveService(client: HttpClient): LeaveService {
  return {
    async getBalances({ employeeId, year }, { signal } = {}) {
      const body = await client.get('leave/balances/', {
        signal,
        query: { employee: employeeId, year },
      })
      return parseApiResponse(z.array(leaveBalanceSchema), body)
    },
    async getLedger({ employeeId, year }, { signal } = {}) {
      const body = await client.get('leave/ledger/', {
        signal,
        query: { employee: employeeId, year },
      })
      return parseApiResponse(z.array(ledgerEntrySchema), body)
    },
    async adjustAllocation(input) {
      const body = await client.post('leave/allocations/', {
        employee_id: input.employeeId,
        leave_type: input.leaveType,
        year: input.year,
        days: input.days,
        reason: input.reason,
      })
      return parseApiResponse(ledgerEntrySchema, body)
    },
    async previewRoute(managerIds, { signal } = {}) {
      const body = await client.get('leave/route/', {
        signal,
        query: managerIds ? { manager: managerIds } : undefined,
      })
      return parseApiResponse(routePreviewSchema, body)
    },
    async listMine({ signal } = {}) {
      return parseApiResponse(
        z.array(leaveRequestSchema),
        await client.get('leave/requests/me/', { signal }),
      )
    },
    async submit(input) {
      // Multipart so the optional attachment travels with the request (D-088 limits).
      const form = new FormData()
      form.append('leave_type', input.leaveType)
      form.append('start_date', input.startDate)
      form.append('end_date', input.endDate)
      form.append('requested_days', String(input.requestedDays))
      form.append('reason', input.reason)
      for (const id of input.managerIds) form.append('manager_ids', id)
      if (input.attachment) form.append('attachment', input.attachment)
      return parseApiResponse(leaveRequestDetailSchema, await client.post('leave/requests/', form))
    },
    async list(query, { signal } = {}) {
      const body = await client.get('leave/requests/', {
        signal,
        query: {
          page: query.page,
          page_size: query.pageSize,
          status: query.status,
          leave_type: query.leaveType,
          department: query.departmentId,
          employee: query.employeeId,
          from: query.from,
          to: query.to,
        },
      })
      return parseApiResponse(pageSchema(leaveRequestSchema), body)
    },
    async get(id, { signal } = {}) {
      return parseApiResponse(
        leaveRequestDetailSchema,
        await client.get(requestPath(id), { signal }),
      )
    },
    async cancel(id, input) {
      const body = await client.post(requestPath(id, 'cancel'), {
        reason: input.reason,
        version: input.version,
      })
      return parseApiResponse(leaveRequestDetailSchema, body)
    },
    async getSummary({ signal } = {}) {
      return parseApiResponse(leaveSummarySchema, await client.get('leave/summary/', { signal }))
    },
  }
}

export function createHttpApprovalService(client: HttpClient): ApprovalService {
  return {
    async inbox(tab, { signal } = {}) {
      return parseApiResponse(
        z.array(approvalTaskSchema),
        await client.get('leave/approvals/', { signal, query: { tab } }),
      )
    },
    async act(id, input) {
      const body = await client.post(requestPath(id, 'actions'), {
        action: input.action,
        comment: input.comment,
        version: input.version,
      })
      return parseApiResponse(leaveRequestDetailSchema, body)
    },
  }
}
