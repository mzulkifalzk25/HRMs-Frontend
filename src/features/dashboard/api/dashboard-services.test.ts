// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '@/services/api'
import { ANNUAL_LEAVE_ALLOWANCE } from '@/types/hr'
import {
  associatePmDashboardSchema,
  employeeDashboardSchema,
  hrDashboardSchema,
  managerDashboardSchema,
  seniorPmDashboardSchema,
  teamLeadDashboardSchema,
} from '../schemas/dashboard.schema'
import { createHttpDashboardService } from './dashboard.http'
import { createMockDashboardService } from './dashboard.mock'

const fixedNow = () => new Date('2026-11-25T06:00:00Z') // 11:00 in Karachi
const mock = createMockDashboardService({ latencyMs: 0, now: fixedNow })

describe('mock dashboards satisfy the contract schemas', () => {
  it.each([
    ['HR', () => mock.getHrDashboard(), hrDashboardSchema],
    ['Manager', () => mock.getManagerDashboard(), managerDashboardSchema],
    ['Senior PM', () => mock.getSeniorPmDashboard(), seniorPmDashboardSchema],
    ['Associate PM', () => mock.getAssociatePmDashboard(), associatePmDashboardSchema],
    ['Team Lead', () => mock.getTeamLeadDashboard(), teamLeadDashboardSchema],
    ['Employee', () => mock.getEmployeeDashboard(), employeeDashboardSchema],
  ] as const)('%s', async (_name, load, schema) => {
    const data = await load()
    const result = schema.safeParse(data)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
  })
})

describe('mock data rules', () => {
  it('uses the confirmed 7/7/7 allowances and consistent balances', async () => {
    const { leaveBalances } = await mock.getEmployeeDashboard()
    expect(leaveBalances.map((b) => b.allocated)).toEqual(Object.values(ANNUAL_LEAVE_ALLOWANCE))
    for (const balance of leaveBalances) {
      expect(balance.remaining).toBe(balance.allocated - balance.used)
    }
  })

  it('dates are relative to today in Karachi, and the trend ends today', async () => {
    const { attendanceTrend } = await mock.getHrDashboard()
    expect(attendanceTrend).toHaveLength(14)
    expect(attendanceTrend.at(-1)?.date).toBe('2026-11-25')
    expect(attendanceTrend[0]?.date).toBe('2026-11-12')
    const employee = await mock.getEmployeeDashboard()
    expect(employee.today.date).toBe('2026-11-25')
    expect(employee.today.checkInAt).toBe('2026-11-25T09:07:00.000+05:00')
  })

  it('team summaries match the listed members', async () => {
    const manager = await mock.getManagerDashboard()
    expect(manager.teamAttendance.total).toBe(manager.team.length)
    const counted =
      manager.teamAttendance.present +
      manager.teamAttendance.late +
      manager.teamAttendance.onLeave +
      manager.teamAttendance.notCheckedIn +
      manager.teamAttendance.absent
    expect(counted).toBe(manager.team.length)
  })

  it('assigns each role the stage it is responsible for', async () => {
    expect(
      (await mock.getManagerDashboard()).approvalInbox.every((t) => t.stage === 'final_approval'),
    ).toBe(true)
    expect(
      (await mock.getAssociatePmDashboard()).reviewTasks.every((t) => t.stage === 'recommendation'),
    ).toBe(true)
    expect((await mock.getTeamLeadDashboard()).reviewTasks.every((t) => t.stage === 'review')).toBe(
      true,
    )
  })
})

describe('createHttpDashboardService', () => {
  it('calls the role endpoint, camelizes snake_case and validates the contract', async () => {
    const body = {
      team: [{ id: 'e1', name: 'Ali D.', designation: 'Engineer', today_status: 'late' }],
      team_attendance: { total: 1, present: 0, late: 1, on_leave: 0, not_checked_in: 0, absent: 0 },
      review_tasks: [],
    }
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const service = createHttpDashboardService(
      createHttpClient({
        baseUrl: 'http://localhost:8000/api/v1',
        fetch: fetchMock as typeof fetch,
      }),
    )
    const data = await service.getTeamLeadDashboard()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:8000/api/v1/dashboard/team-lead/',
    )
    expect(data.team[0]?.todayStatus).toBe('late')
    expect(data.teamAttendance.onLeave).toBe(0)
  })

  it('rejects responses that break the contract', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ team: 'nope' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const service = createHttpDashboardService(
      createHttpClient({
        baseUrl: 'http://localhost:8000/api/v1',
        fetch: fetchMock as typeof fetch,
      }),
    )
    await expect(service.getTeamLeadDashboard()).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
