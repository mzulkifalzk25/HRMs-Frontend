// HTTP AttendanceService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { z } from 'zod'
import { parseApiResponse, type HttpClient } from '@/services/api'
import { pageSchema } from '@/types/api'
import {
  attendanceRecordSchema,
  attendanceSummarySchema,
  correctionEntrySchema,
  todayAttendanceSchema,
} from '../schemas/attendance.schema'
import type { AttendanceService } from './attendance.service'

const listSchema = pageSchema(attendanceRecordSchema)
const path = (id: string, action = '') =>
  `attendance/${encodeURIComponent(id)}/${action ? `${action}/` : ''}`

export function createHttpAttendanceService(client: HttpClient): AttendanceService {
  return {
    async getToday({ signal } = {}) {
      return parseApiResponse(
        todayAttendanceSchema,
        await client.get('attendance/me/today/', { signal }),
      )
    },
    async checkIn() {
      return parseApiResponse(attendanceRecordSchema, await client.post('attendance/me/check-in/'))
    },
    async checkOut() {
      return parseApiResponse(attendanceRecordSchema, await client.post('attendance/me/check-out/'))
    },
    async listMine({ from, to }, { signal } = {}) {
      return parseApiResponse(
        z.array(attendanceRecordSchema),
        await client.get('attendance/me/', { signal, query: { from, to } }),
      )
    },
    async list(query, { signal } = {}) {
      const body = await client.get('attendance/', {
        signal,
        query: {
          from: query.from,
          to: query.to,
          page: query.page,
          page_size: query.pageSize,
          employee: query.employeeId,
          department: query.departmentId,
          team: query.teamId,
          filter: query.filter,
        },
      })
      return parseApiResponse(listSchema, body)
    },
    async get(id, { signal } = {}) {
      return parseApiResponse(attendanceRecordSchema, await client.get(path(id), { signal }))
    },
    async correct(id, input) {
      return parseApiResponse(
        attendanceRecordSchema,
        await client.post(path(id, 'corrections'), {
          check_in_at: input.checkInAt,
          check_out_at: input.checkOutAt,
          reason: input.reason,
        }),
      )
    },
    async listCorrections(id, { signal } = {}) {
      return parseApiResponse(
        z.array(correctionEntrySchema),
        await client.get(path(id, 'corrections'), { signal }),
      )
    },
    async getSummary({ signal } = {}) {
      return parseApiResponse(
        attendanceSummarySchema,
        await client.get('attendance/summary/', { signal }),
      )
    },
  }
}
