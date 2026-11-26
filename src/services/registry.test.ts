// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, createHttpClient, type HttpClient } from '@/services/api'
import { createMockHealthService } from '@/services/health/health.mock'
import { healthStatusSchema } from '@/services/health/health.service'
import { simulateLatency } from '@/services/mock/latency'
import { createServices } from './registry'

function fakeClient(body: unknown): HttpClient & { getMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  const client = createHttpClient({
    baseUrl: 'http://localhost:8000/api/v1',
    fetch: fetchMock as typeof fetch,
  })
  return Object.assign(client, { getMock: fetchMock })
}

describe('createServices', () => {
  it('returns mock implementations when useMockApi is true', async () => {
    const client = fakeClient({})
    const services = createServices({ useMockApi: true, client, mockLatencyMs: 0 })
    expect(services.mode).toBe('mock')
    const status = await services.health.getStatus()
    expect(status.source).toBe('mock')
    expect(healthStatusSchema.parse(status)).toEqual(status)
    expect(client.getMock).not.toHaveBeenCalled()
  })

  it('provides every domain service in both modes, including notifications (P6)', () => {
    for (const useMockApi of [true, false]) {
      const services = createServices({ useMockApi, client: fakeClient({}), mockLatencyMs: 0 })
      expect(typeof services.notifications.unreadCount).toBe('function')
      expect(typeof services.announcements.create).toBe('function')
    }
  })

  it('returns HTTP implementations when useMockApi is false', async () => {
    const client = fakeClient({ status: 'ok', checked_at: '2026-11-25T09:15:00+05:00' })
    const services = createServices({ useMockApi: false, client })
    expect(services.mode).toBe('http')
    await expect(services.health.getStatus()).resolves.toEqual({
      status: 'ok',
      source: 'api',
      checkedAt: '2026-11-25T09:15:00+05:00',
    })
    expect(String(client.getMock.mock.calls[0]?.[0])).toBe('http://localhost:8000/api/v1/health/')
  })

  it('both implementations satisfy the same contract schema', async () => {
    const http = createServices({
      useMockApi: false,
      client: fakeClient({ status: 'degraded', checked_at: '2026-11-25T04:15:00Z' }),
    })
    const mock = createServices({ useMockApi: true, client: fakeClient({}), mockLatencyMs: 0 })
    for (const result of [await http.health.getStatus(), await mock.health.getStatus()]) {
      expect(healthStatusSchema.safeParse(result).success).toBe(true)
    }
  })

  it('HTTP implementation rejects a response that breaks the contract', async () => {
    const services = createServices({
      useMockApi: false,
      client: fakeClient({ status: 'ok', checked_at: '2026-11-25 09:15' }),
    })
    await expect(services.health.getStatus()).rejects.toMatchObject({ code: 'invalid_response' })
  })
})

describe('createServices: Phase 2 services', () => {
  it('exposes auth and dashboard in both modes, and mock fixtures only in mock mode', async () => {
    const mock = createServices({ useMockApi: true, client: fakeClient({}), mockLatencyMs: 0 })
    const http = createServices({ useMockApi: false, client: fakeClient({}) })
    expect(mock.mockFixtures?.demoAccounts).toHaveLength(6)
    expect(mock.mockFixtures?.demoAccounts.every((a) => a.email.endsWith('@formbaxhr.test'))).toBe(
      true,
    )
    expect(http.mockFixtures).toBeNull()
    for (const services of [mock, http]) {
      expect(typeof services.auth.login).toBe('function')
      expect(typeof services.dashboard.getHrDashboard).toBe('function')
    }
    const session = await mock.auth.login({
      email: 'hr.admin@formbaxhr.test',
      password: mock.mockFixtures?.demoPassword ?? '',
    })
    expect(session.user.role).toBe('hr_admin')
  })
})

describe('mock infrastructure', () => {
  it('mock health service uses the injected clock', async () => {
    const service = createMockHealthService({
      latencyMs: 0,
      now: () => new Date('2026-11-25T04:15:00.000Z'),
    })
    await expect(service.getStatus()).resolves.toMatchObject({
      checkedAt: '2026-11-25T04:15:00.000Z',
    })
  })

  it('simulated latency can be cancelled like a real request', async () => {
    const controller = new AbortController()
    const pending = simulateLatency(10_000, controller.signal)
    controller.abort()
    await expect(pending).rejects.toBeInstanceOf(ApiError)
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
  })

  it('simulated latency rejects immediately for an already-aborted signal', async () => {
    await expect(simulateLatency(10_000, AbortSignal.abort())).rejects.toMatchObject({
      code: 'aborted',
    })
  })
})
