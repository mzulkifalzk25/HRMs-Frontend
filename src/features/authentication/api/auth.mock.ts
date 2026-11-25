// Mock AuthService (P2-T02). FICTIONAL accounts only (D-073): names carry the surname "Demo",
// emails use the reserved `.test` domain, and the shared password is a mock-mode value shown on
// the login page in mock mode. Nothing here is a production credential.
// State lives in memory for the browser session, like a real server would keep it: password
// changes stick, invitations can be used once, and a page reload ends the mock session
// (the real app restores sessions through the httpOnly refresh cookie, D-079).
import { ApiError } from '@/services/api'
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type { AuthSession, Role, TokenCheck, User } from '../types'
import type { AuthService } from './auth.service'

export const MOCK_PASSWORD = 'FormbaxDemo!2026'

export type MockAccount = User & { password: string }

export const MOCK_ACCOUNTS: readonly MockAccount[] = [
  {
    id: 'u-hr-001',
    email: 'hr.admin@formbaxhr.test',
    firstName: 'Sana',
    lastName: 'Demo',
    role: 'hr_admin',
    employeeCode: 'FBX-1001',
    designation: 'HR Administrator',
    department: 'Human Resources',
    password: MOCK_PASSWORD,
  },
  {
    id: 'u-mgr-001',
    email: 'manager@formbaxhr.test',
    firstName: 'Imran',
    lastName: 'Demo',
    role: 'manager',
    employeeCode: 'FBX-1002',
    designation: 'Engineering Manager',
    department: 'Engineering',
    password: MOCK_PASSWORD,
  },
  {
    id: 'u-spm-001',
    email: 'senior.pm@formbaxhr.test',
    firstName: 'Farah',
    lastName: 'Demo',
    role: 'senior_pm',
    employeeCode: 'FBX-1003',
    designation: 'Senior Project Manager',
    department: 'Delivery',
    password: MOCK_PASSWORD,
  },
  {
    id: 'u-apm-001',
    email: 'associate.pm@formbaxhr.test',
    firstName: 'Usman',
    lastName: 'Demo',
    role: 'associate_pm',
    employeeCode: 'FBX-1004',
    designation: 'Associate Project Manager',
    department: 'Delivery',
    password: MOCK_PASSWORD,
  },
  {
    id: 'u-tl-001',
    email: 'team.lead@formbaxhr.test',
    firstName: 'Zainab',
    lastName: 'Demo',
    role: 'team_lead',
    employeeCode: 'FBX-1005',
    designation: 'Team Lead, Frontend',
    department: 'Engineering',
    password: MOCK_PASSWORD,
  },
  {
    id: 'u-emp-001',
    email: 'employee@formbaxhr.test',
    firstName: 'Ali',
    lastName: 'Demo',
    role: 'employee',
    employeeCode: 'FBX-1006',
    designation: 'Software Engineer',
    department: 'Engineering',
    password: MOCK_PASSWORD,
  },
]

/** Tokens for the emailed-link flows in mock mode (shown as hints on the mock pages). */
export const MOCK_TOKENS = {
  resetValid: 'mock-reset-valid',
  resetExpired: 'mock-reset-expired',
  inviteValid: 'mock-invite-valid',
  inviteExpired: 'mock-invite-expired',
  inviteUsed: 'mock-invite-used',
} as const

export const MOCK_INVITED_EMAIL = 'new.hire@formbaxhr.test'

const INVALID_CREDENTIALS = 'Email or password is incorrect.'

function toUser({ password: _password, ...user }: MockAccount): User {
  return user
}

export function createMockAuthService(options: { latencyMs?: number } = {}): AuthService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const accounts = new Map(MOCK_ACCOUNTS.map((account) => [account.email, { ...account }]))
  const usedInvites = new Set<string>([MOCK_TOKENS.inviteUsed])
  let current: { userEmail: string; refreshGeneration: number } | null = null
  let tokenCounter = 0

  const issue = (account: MockAccount): AuthSession => {
    tokenCounter += 1
    return { user: toUser(account), accessToken: `mock-access-${account.role}-${tokenCounter}` }
  }

  const unauthorized = () =>
    new ApiError({
      status: 401,
      code: 'unauthorized',
      message: 'Your session has expired. Please sign in again.',
    })

  const checkReset = (token: string): TokenCheck => {
    if (token === MOCK_TOKENS.resetValid) return { status: 'valid' }
    if (token === MOCK_TOKENS.resetExpired) return { status: 'expired' }
    return { status: 'invalid' }
  }

  const checkInvite = (token: string): TokenCheck => {
    if (usedInvites.has(token)) return { status: 'used' }
    if (token === MOCK_TOKENS.inviteValid) return { status: 'valid', email: MOCK_INVITED_EMAIL }
    if (token === MOCK_TOKENS.inviteExpired) return { status: 'expired' }
    return { status: 'invalid' }
  }

  return {
    async login({ email, password }) {
      await simulateLatency(latency)
      const account = accounts.get(email.trim().toLowerCase())
      if (!account || account.password !== password) {
        throw new ApiError({
          status: 401,
          code: 'invalid_credentials',
          message: INVALID_CREDENTIALS,
        })
      }
      current = { userEmail: account.email, refreshGeneration: 0 }
      return issue(account)
    },

    async logout() {
      await simulateLatency(latency)
      current = null // the mock equivalent of blacklisting the refresh token (D-078)
    },

    async restoreSession() {
      await simulateLatency(latency)
      const account = current ? accounts.get(current.userEmail) : undefined
      return account ? issue(account) : null
    },

    async refresh() {
      await simulateLatency(latency)
      const account = current ? accounts.get(current.userEmail) : undefined
      if (!current || !account) throw unauthorized()
      current.refreshGeneration += 1 // rotation (D-079)
      return issue(account)
    },

    async getCurrentUser({ signal } = {}) {
      await simulateLatency(latency, signal)
      const account = current ? accounts.get(current.userEmail) : undefined
      if (!account) throw unauthorized()
      return toUser(account)
    },

    async requestPasswordReset() {
      await simulateLatency(latency)
      // Same response whether or not the account exists (no enumeration).
    },

    async checkResetToken(token) {
      await simulateLatency(latency)
      return checkReset(token)
    },

    async resetPassword(token, password) {
      await simulateLatency(latency)
      const check = checkReset(token)
      if (check.status !== 'valid') {
        throw new ApiError({
          status: 400,
          code: `token_${check.status}`,
          message: 'This reset link is no longer valid. Request a new one.',
        })
      }
      // The mock reset link belongs to the Employee demo account.
      const account = accounts.get('employee@formbaxhr.test')
      if (account) account.password = password
    },

    async checkInvitation(token) {
      await simulateLatency(latency)
      return checkInvite(token)
    },

    async acceptInvitation(token, password) {
      await simulateLatency(latency)
      const check = checkInvite(token)
      if (check.status !== 'valid') {
        throw new ApiError({
          status: 400,
          code: `token_${check.status}`,
          message: 'This invitation is no longer valid. Ask HR for a new one.',
        })
      }
      usedInvites.add(token)
      const role: Role = 'employee'
      accounts.set(MOCK_INVITED_EMAIL, {
        id: 'u-new-001',
        email: MOCK_INVITED_EMAIL,
        firstName: 'New',
        lastName: 'Demo',
        role,
        employeeCode: 'FBX-1099',
        designation: 'Software Engineer',
        department: 'Engineering',
        password,
      })
    },
  }
}
