// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ApiError } from './api-error'
import { buildUrl, createHttpClient, type AuthHooks } from './http-client'

const BASE = 'http://localhost:8000/api/v1'

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function setup(responses: Array<Response | (() => Promise<Response>)>, auth?: AuthHooks) {
  const queue = [...responses]
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift()
    if (!next) throw new Error('unexpected fetch call')
    return typeof next === 'function' ? next() : next
  })
  const client = createHttpClient({ baseUrl: BASE, fetch: fetchMock as typeof fetch, auth })
  const call = (index = 0) => {
    const [url, init] = fetchMock.mock.calls[index] ?? []
    return { url: String(url), init: init ?? {}, headers: new Headers(init?.headers) }
  }
  return { client, fetchMock, call }
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected an ApiError')
}

describe('buildUrl', () => {
  it('joins base and path with exactly one slash', () => {
    expect(buildUrl(`${BASE}/`, '/employees/')).toBe(`${BASE}/employees/`)
    expect(buildUrl(BASE, 'employees/')).toBe(`${BASE}/employees/`)
  })

  it('serializes query params, repeats arrays and skips empty values', () => {
    const url = buildUrl(BASE, 'employees/', {
      page: 2,
      search: 'ayesha demo',
      status: ['active', 'on_leave'],
      team: undefined,
      manager: null,
      q: '',
      active: true,
    })
    expect(url).toBe(
      `${BASE}/employees/?page=2&search=ayesha+demo&status=active&status=on_leave&active=true`,
    )
  })

  it('rejects absolute URLs so auth headers never go to another origin', () => {
    expect(() => buildUrl(BASE, 'https://evil.example/steal')).toThrow(/relative/)
    expect(() => buildUrl(BASE, '//evil.example/steal')).toThrow(/relative/)
  })
})

describe('createHttpClient: success', () => {
  it('GETs JSON with Accept header and returns the parsed body', async () => {
    const { client, call } = setup([json(200, { ok: true })])
    await expect(client.get('health/')).resolves.toEqual({ ok: true })
    expect(call().url).toBe(`${BASE}/health/`)
    expect(call().init.method).toBe('GET')
    expect(call().headers.get('Accept')).toBe('application/json')
    expect(call().headers.has('Content-Type')).toBe(false)
  })

  it('sends JSON bodies with Content-Type', async () => {
    const { client, call } = setup([json(201, { id: 1 })])
    await client.post('leaves/', { leave_type: 'casual' })
    expect(call().init.method).toBe('POST')
    expect(call().headers.get('Content-Type')).toBe('application/json')
    expect(call().init.body).toBe('{"leave_type":"casual"}')
  })

  it('passes FormData through without forcing a JSON content type', async () => {
    const { client, call } = setup([json(201, { id: 'import-1' })])
    const form = new FormData()
    form.append('file', new Blob(['x']), 'employees.xlsx')
    await client.post('imports/', form)
    expect(call().init.body).toBe(form)
    expect(call().headers.has('Content-Type')).toBe(false)
  })

  it('returns undefined for 204 No Content', async () => {
    const { client } = setup([new Response(null, { status: 204 })])
    await expect(client.delete('notifications/1/')).resolves.toBeUndefined()
  })

  it('validates responses with a Zod schema when given', async () => {
    const schema = z.object({ status: z.literal('ok') })
    const { client } = setup([json(200, { status: 'ok' }), json(200, { status: 'down' })])
    await expect(client.get('health/', { schema })).resolves.toEqual({ status: 'ok' })
    const error = await rejection(client.get('health/', { schema }))
    expect(error.code).toBe('invalid_response')
  })

  it('reports unreadable JSON as invalid_response', async () => {
    const { client } = setup([
      new Response('{not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ])
    expect((await rejection(client.get('x/'))).code).toBe('invalid_response')
  })
})

describe('createHttpClient: credentials', () => {
  it('uses same-origin by default and lets a request include cookies', async () => {
    const { client, call } = setup([json(200, {}), json(200, {})])
    await client.get('employees/')
    await client.post('auth/refresh/', undefined, { credentials: 'include', auth: false })
    expect(call(0).init.credentials).toBe('same-origin')
    expect(call(1).init.credentials).toBe('include')
  })
})

describe('createHttpClient: error normalization', () => {
  it('uses the DRF "detail" message and status-based code', async () => {
    const { client } = setup([
      json(403, { detail: 'You do not have permission to perform this action.' }),
    ])
    const error = await rejection(client.get('employees/'))
    expect(error).toMatchObject({
      status: 403,
      code: 'forbidden',
      message: 'You do not have permission to perform this action.',
    })
  })

  it('maps DRF serializer errors to fieldErrors and validation_error', async () => {
    const { client } = setup([
      json(400, { email: ['Enter a valid email address.'], start_date: 'Required.' }),
    ])
    const error = await rejection(client.post('employees/', {}))
    expect(error.code).toBe('validation_error')
    expect(error.fieldErrors).toEqual({
      email: ['Enter a valid email address.'],
      start_date: ['Required.'],
    })
  })

  it('uses non_field_errors as the message', async () => {
    const { client } = setup([
      json(400, { non_field_errors: ['End date must be after start date.'] }),
    ])
    const error = await rejection(client.post('leaves/', {}))
    expect(error.message).toBe('End date must be after start date.')
  })

  it('understands the proposed error envelope', async () => {
    const { client } = setup([
      json(409, {
        error: { code: 'already_decided', message: 'Request already approved.', fields: {} },
      }),
    ])
    const error = await rejection(client.post('approvals/1/approve/', {}))
    expect(error).toMatchObject({
      status: 409,
      code: 'already_decided',
      message: 'Request already approved.',
    })
  })

  it('handles non-JSON server errors with a safe generic message', async () => {
    const { client } = setup([
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    ])
    const error = await rejection(client.get('x/'))
    expect(error).toMatchObject({ status: 502, code: 'server_error' })
    expect(error.message).not.toContain('<html>')
    expect(error.isRetryable).toBe(true)
  })

  it('reports network failures as network_error with status 0', async () => {
    const { client } = setup([() => Promise.reject(new TypeError('Failed to fetch'))])
    const error = await rejection(client.get('x/'))
    expect(error).toMatchObject({ status: 0, code: 'network_error' })
    expect(error.isRetryable).toBe(true)
  })
})

describe('createHttpClient: abort and timeout', () => {
  function hangingFetch() {
    return vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
  }

  it('reports caller cancellation as aborted', async () => {
    const fetchMock = hangingFetch()
    const client = createHttpClient({ baseUrl: BASE, fetch: fetchMock as typeof fetch })
    const controller = new AbortController()
    const pending = client.get('x/', { signal: controller.signal })
    controller.abort()
    const error = await rejection(pending)
    expect(error.code).toBe('aborted')
    expect(error.isAborted).toBe(true)
    expect(error.isRetryable).toBe(false)
  })

  it('reports slow responses as timeout', async () => {
    const fetchMock = hangingFetch()
    const client = createHttpClient({ baseUrl: BASE, fetch: fetchMock as typeof fetch })
    const error = await rejection(client.get('x/', { timeoutMs: 20 }))
    expect(error.code).toBe('timeout')
  })
})

describe('createHttpClient: auth hooks', () => {
  it('adds the bearer token, but not for auth:false requests', async () => {
    const { client, call } = setup([json(200, {}), json(200, {})], {
      getAccessToken: () => 'token-123',
    })
    await client.get('me/')
    await client.post('auth/login/', { email: 'demo@formbaxhr.test' }, { auth: false })
    expect(call(0).headers.get('Authorization')).toBe('Bearer token-123')
    expect(call(1).headers.has('Authorization')).toBe(false)
  })

  it('refreshes once on 401 and retries the request', async () => {
    let token = 'old'
    const refreshSession = vi.fn(async () => {
      token = 'new'
      return true
    })
    const { client, call } = setup([json(401, { detail: 'expired' }), json(200, { id: 7 })], {
      getAccessToken: () => token,
      refreshSession,
    })
    await expect(client.get('me/')).resolves.toEqual({ id: 7 })
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(call(1).headers.get('Authorization')).toBe('Bearer new')
  })

  it('shares one refresh between concurrent 401 responses', async () => {
    let resolveRefresh: (value: boolean) => void = () => {}
    const refreshSession = vi.fn(
      () => new Promise<boolean>((resolve) => (resolveRefresh = resolve)),
    )
    const { client } = setup(
      [json(401, {}), json(401, {}), json(200, { a: 1 }), json(200, { b: 2 })],
      { refreshSession },
    )
    const both = Promise.all([client.get('a/'), client.get('b/')])
    await vi.waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1))
    resolveRefresh(true)
    await expect(both).resolves.toEqual([{ a: 1 }, { b: 2 }])
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('calls onSessionExpired and throws 401 when refresh fails', async () => {
    const onSessionExpired = vi.fn()
    const { client } = setup([json(401, { detail: 'expired' })], {
      refreshSession: async () => false,
      onSessionExpired,
    })
    const error = await rejection(client.get('me/'))
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' })
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('retries at most once, even if the retry also returns 401', async () => {
    const onSessionExpired = vi.fn()
    const refreshSession = vi.fn(async () => true)
    const { client, fetchMock } = setup([json(401, {}), json(401, {})], {
      refreshSession,
      onSessionExpired,
    })
    expect((await rejection(client.get('me/'))).status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('does not refresh for auth:false requests (e.g. wrong password on login)', async () => {
    const refreshSession = vi.fn(async () => true)
    const { client } = setup([json(401, { detail: 'Invalid credentials.' })], { refreshSession })
    const error = await rejection(client.post('auth/login/', {}, { auth: false }))
    expect(error.message).toBe('Invalid credentials.')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('treats a throwing refresh as a failed refresh', async () => {
    const onSessionExpired = vi.fn()
    const { client } = setup([json(401, {})], {
      refreshSession: async () => {
        throw new Error('refresh endpoint down')
      },
      onSessionExpired,
    })
    expect((await rejection(client.get('me/'))).status).toBe(401)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('accepts hooks installed later with setAuthHooks', async () => {
    const { client, call } = setup([json(200, {})])
    client.setAuthHooks({ getAccessToken: () => 'later' })
    await client.get('me/')
    expect(call().headers.get('Authorization')).toBe('Bearer later')
  })
})
