// Service registry (P1-T11, D-026): the ONLY place that chooses mock or HTTP implementations.
// Screens and hooks import `services` from here and never import `*.mock` files (enforced by lint).
// Switching VITE_USE_MOCK_API changes the implementations without touching UI code.
import { createHttpAuthService } from '@/features/authentication/api/auth.http'
import {
  createMockAuthService,
  MOCK_ACCOUNTS,
  MOCK_INVITED_EMAIL,
  MOCK_PASSWORD,
  MOCK_TOKENS,
} from '@/features/authentication/api/auth.mock'
import type { AuthService } from '@/features/authentication/api/auth.service'
import type { Role } from '@/features/authentication/types'
import { createHttpDashboardService } from '@/features/dashboard/api/dashboard.http'
import { createMockDashboardService } from '@/features/dashboard/api/dashboard.mock'
import type { DashboardService } from '@/features/dashboard/api/dashboard.service'
import { env } from '@/lib/env'
import { apiClient, type HttpClient } from '@/services/api'
import { createHttpHealthService } from '@/services/health/health.http'
import { createMockHealthService } from '@/services/health/health.mock'
import type { HealthService } from '@/services/health/health.service'

export type ServiceMode = 'mock' | 'http'

/** Demo data the UI may show in mock mode only (login hints, test links). Absent in HTTP mode. */
export type MockFixtures = {
  demoPassword: string
  demoAccounts: ReadonlyArray<{ email: string; name: string; role: Role }>
  resetLinks: { valid: string; expired: string }
  inviteLinks: { valid: string; expired: string; used: string }
  invitedEmail: string
}

export type Services = {
  /** Which implementation set is active; the UI shows a "Mock data" badge for `mock`. */
  mode: ServiceMode
  mockFixtures: MockFixtures | null
  health: HealthService
  auth: AuthService
  dashboard: DashboardService
}

export function createServices(options: {
  useMockApi: boolean
  client: HttpClient
  mockLatencyMs?: number
}): Services {
  if (options.useMockApi) {
    const latencyMs = options.mockLatencyMs
    return {
      mode: 'mock',
      mockFixtures: {
        demoPassword: MOCK_PASSWORD,
        demoAccounts: MOCK_ACCOUNTS.map((account) => ({
          email: account.email,
          name: `${account.firstName} ${account.lastName}`,
          role: account.role,
        })),
        resetLinks: {
          valid: `/reset-password?token=${MOCK_TOKENS.resetValid}`,
          expired: `/reset-password?token=${MOCK_TOKENS.resetExpired}`,
        },
        inviteLinks: {
          valid: `/invite?token=${MOCK_TOKENS.inviteValid}`,
          expired: `/invite?token=${MOCK_TOKENS.inviteExpired}`,
          used: `/invite?token=${MOCK_TOKENS.inviteUsed}`,
        },
        invitedEmail: MOCK_INVITED_EMAIL,
      },
      health: createMockHealthService({ latencyMs }),
      auth: createMockAuthService({ latencyMs }),
      dashboard: createMockDashboardService({ latencyMs }),
    }
  }
  return {
    mode: 'http',
    mockFixtures: null,
    health: createHttpHealthService(options.client),
    auth: createHttpAuthService(options.client),
    dashboard: createHttpDashboardService(options.client),
  }
}

export const services: Services = createServices({
  useMockApi: env.useMockApi,
  client: apiClient,
})
