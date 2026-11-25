// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, createHttpClient } from '@/services/api'
import { ROLES } from '../types'
import { createHttpAuthService } from './auth.http'
import {
  createMockAuthService,
  MOCK_ACCOUNTS,
  MOCK_INVITED_EMAIL,
  MOCK_PASSWORD,
  MOCK_TOKENS,
} from './auth.mock'

const BASE = 'http://localhost:8000/api/v1'

describe('mock accounts (fictional data review, D-073)', () => {
  it('has exactly one fictional account per role', () => {
    expect(MOCK_ACCOUNTS.map((account) => account.role).sort()).toEqual([...ROLES].sort())
    for (const account of MOCK_ACCOUNTS) {
      expect(account.email).toMatch(/@formbaxhr\.test$/) // reserved .test domain
      expect(account.lastName).toBe('Demo')
      expect(account.employeeCode).toMatch(/^FBX-\d{4}$/)
    }
  })
})

describe('createMockAuthService', () => {
  const svc = () => createMockAuthService({ latencyMs: 0 })

  it('signs in with the demo password, case-insensitive email', async () => {
    const session = await svc().login({ email: 'MANAGER@formbaxhr.test', password: MOCK_PASSWORD })
    expect(session.user.role).toBe('manager')
    expect(session.accessToken).toMatch(/^mock-access-/)
    expect(session.user).not.toHaveProperty('password')
  })

  it('uses one generic error for unknown email and wrong password (no enumeration)', async () => {
    const auth = svc()
    const unknown = auth.login({ email: 'nobody@formbaxhr.test', password: MOCK_PASSWORD })
    const wrong = auth.login({ email: 'manager@formbaxhr.test', password: 'wrong' })
    await expect(unknown).rejects.toMatchObject({
      status: 401,
      message: 'Email or password is incorrect.',
    })
    await expect(wrong).rejects.toMatchObject({
      status: 401,
      message: 'Email or password is incorrect.',
    })
  })

  it('restores, refreshes with new tokens, and ends the session on logout', async () => {
    const auth = svc()
    expect(await auth.restoreSession()).toBeNull()
    const first = await auth.login({ email: 'employee@formbaxhr.test', password: MOCK_PASSWORD })
    const refreshed = await auth.refresh()
    expect(refreshed.accessToken).not.toBe(first.accessToken)
    expect((await auth.restoreSession())?.user.email).toBe('employee@formbaxhr.test')
    await expect(auth.getCurrentUser()).resolves.toMatchObject({ role: 'employee' })
    await auth.logout()
    expect(await auth.restoreSession()).toBeNull()
    await expect(auth.refresh()).rejects.toMatchObject({ status: 401 })
    await expect(auth.getCurrentUser()).rejects.toMatchObject({ status: 401 })
  })

  it('handles reset tokens and makes the new password effective', async () => {
    const auth = svc()
    await expect(auth.requestPasswordReset('nobody@formbaxhr.test')).resolves.toBeUndefined()
    await expect(auth.checkResetToken(MOCK_TOKENS.resetValid)).resolves.toEqual({ status: 'valid' })
    await expect(auth.checkResetToken(MOCK_TOKENS.resetExpired)).resolves.toEqual({
      status: 'expired',
    })
    await expect(auth.checkResetToken('garbage')).resolves.toEqual({ status: 'invalid' })
    await expect(
      auth.resetPassword(MOCK_TOKENS.resetExpired, 'New pass 123'),
    ).rejects.toBeInstanceOf(ApiError)
    await auth.resetPassword(MOCK_TOKENS.resetValid, 'New pass 123')
    await expect(
      auth.login({ email: 'employee@formbaxhr.test', password: MOCK_PASSWORD }),
    ).rejects.toMatchObject({ status: 401 })
    await expect(
      auth.login({ email: 'employee@formbaxhr.test', password: 'New pass 123' }),
    ).resolves.toBeTruthy()
  })

  it('accepts an invitation once and creates a working account', async () => {
    const auth = svc()
    await expect(auth.checkInvitation(MOCK_TOKENS.inviteValid)).resolves.toEqual({
      status: 'valid',
      email: MOCK_INVITED_EMAIL,
    })
    await expect(auth.checkInvitation(MOCK_TOKENS.inviteUsed)).resolves.toEqual({ status: 'used' })
    await expect(auth.checkInvitation(MOCK_TOKENS.inviteExpired)).resolves.toEqual({
      status: 'expired',
    })
    await auth.acceptInvitation(MOCK_TOKENS.inviteValid, 'First pass 123')
    await expect(auth.checkInvitation(MOCK_TOKENS.inviteValid)).resolves.toEqual({ status: 'used' })
    await expect(
      auth.acceptInvitation(MOCK_TOKENS.inviteValid, 'Again 12345'),
    ).rejects.toMatchObject({ code: 'token_used' })
    await expect(
      auth.login({ email: MOCK_INVITED_EMAIL, password: 'First pass 123' }),
    ).resolves.toMatchObject({
      user: { role: 'employee' },
    })
  })

  it('keeps state per instance (no leakage between services)', async () => {
    const a = svc()
    await a.login({ email: 'manager@formbaxhr.test', password: MOCK_PASSWORD })
    expect(await svc().restoreSession()).toBeNull()
  })
})

describe('createHttpAuthService (proposed endpoints)', () => {
  const user = { id: 1, email: 'a@b.test', first_name: 'Ada', last_name: 'Demo', role: 'manager' }
  function setup(responses: Response[]) {
    const queue = [...responses]
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      const next = queue.shift()
      if (!next) throw new Error('unexpected fetch')
      return next
    })
    const client = createHttpClient({ baseUrl: BASE, fetch: fetchMock as typeof fetch })
    const call = (i: number) => ({
      url: String(fetchMock.mock.calls[i]?.[0]),
      init: fetchMock.mock.calls[i]?.[1] ?? {},
    })
    return { auth: createHttpAuthService(client), call }
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('logs in without a bearer token but with cookies, and maps the session', async () => {
    const { auth, call } = setup([json(200, { access: 'jwt-access', user })])
    const session = await auth.login({ email: 'a@b.test', password: 'pw' })
    expect(session).toEqual({
      accessToken: 'jwt-access',
      user: expect.objectContaining({ firstName: 'Ada', role: 'manager' }),
    })
    expect(call(0).url).toBe(`${BASE}/auth/login/`)
    expect(call(0).init.credentials).toBe('include')
    expect(new Headers(call(0).init.headers).has('Authorization')).toBe(false)
  })

  it('restores the session through the refresh cookie, or returns null on 401', async () => {
    const { auth, call } = setup([
      json(200, { access: 'jwt-2', user }),
      json(401, { detail: 'Token is blacklisted' }),
    ])
    await expect(auth.restoreSession()).resolves.toMatchObject({ accessToken: 'jwt-2' })
    expect(call(0).url).toBe(`${BASE}/auth/token/refresh/`)
    expect(call(0).init.credentials).toBe('include')
    await expect(auth.restoreSession()).resolves.toBeNull()
  })

  it('does not treat a server outage as "signed out"', async () => {
    const { auth } = setup([json(503, {})])
    await expect(auth.restoreSession()).rejects.toMatchObject({ status: 503 })
  })

  it('calls logout with cookies so the server can blacklist the refresh token', async () => {
    const { auth, call } = setup([new Response(null, { status: 204 })])
    await auth.logout()
    expect(call(0).url).toBe(`${BASE}/auth/logout/`)
    expect(call(0).init.method).toBe('POST')
    expect(call(0).init.credentials).toBe('include')
  })

  it('sends reset and invitation tokens in the request body, not the URL', async () => {
    const { auth, call } = setup([
      json(200, { status: 'valid' }),
      json(200, { status: 'valid', email: 'new@b.test' }),
      new Response(null, { status: 204 }),
    ])
    await auth.checkResetToken('secret-token')
    await auth.checkInvitation('invite-token')
    await auth.acceptInvitation('invite-token', 'First pass 123')
    for (let i = 0; i < 3; i += 1) expect(call(i).url).not.toContain('token=')
    expect(call(0).init.body).toBe('{"token":"secret-token"}')
    expect(call(2).init.body).toBe('{"token":"invite-token","password":"First pass 123"}')
  })
})
