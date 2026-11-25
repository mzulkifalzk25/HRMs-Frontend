// Service registry (P1-T11, D-026): the ONLY place that chooses mock or HTTP implementations.
// Screens and hooks import `services` from here and never import `*.mock` files (enforced by lint).
// Switching VITE_USE_MOCK_API changes the implementations without touching UI code.
import { env } from '@/lib/env'
import { apiClient, type HttpClient } from '@/services/api'
import { createHttpHealthService } from '@/services/health/health.http'
import { createMockHealthService } from '@/services/health/health.mock'
import type { HealthService } from '@/services/health/health.service'

export type ServiceMode = 'mock' | 'http'

export type Services = {
  /** Which implementation set is active; the UI shows a "Mock data" badge for `mock`. */
  mode: ServiceMode
  health: HealthService
}

export function createServices(options: {
  useMockApi: boolean
  client: HttpClient
  mockLatencyMs?: number
}): Services {
  if (options.useMockApi) {
    return {
      mode: 'mock',
      health: createMockHealthService({ latencyMs: options.mockLatencyMs }),
    }
  }
  return {
    mode: 'http',
    health: createHttpHealthService(options.client),
  }
}

export const services: Services = createServices({
  useMockApi: env.useMockApi,
  client: apiClient,
})
