// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAccessToken, getAccessToken, setAccessToken } from './access-token'
import { createAuthChannel, type AuthChannelMessage } from './auth-channel'
import { REFRESH_LOCK_NAME, withRefreshLock } from './refresh-lock'

afterEach(() => clearAccessToken())

describe('access token holder', () => {
  it('keeps the token in memory only', () => {
    expect(getAccessToken()).toBeNull()
    setAccessToken('abc')
    expect(getAccessToken()).toBe('abc')
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })
})

describe('withRefreshLock', () => {
  it('runs the task under the named Web Lock when available', async () => {
    const requested: string[] = []
    const locks = {
      request<T>(name: string, callback: () => Promise<T>): Promise<T> {
        requested.push(name)
        return callback()
      },
    }
    await expect(withRefreshLock(async () => 'refreshed', locks)).resolves.toBe('refreshed')
    expect(requested).toEqual([REFRESH_LOCK_NAME])
  })

  it('serializes concurrent refreshes through the lock', async () => {
    let chain = Promise.resolve()
    const order: string[] = []
    const locks = {
      request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
        const run = chain.then(callback)
        chain = run.then(
          () => undefined,
          () => undefined,
        )
        return run
      },
    }
    const task = (label: string) => async () => {
      order.push(`${label}:start`)
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push(`${label}:end`)
    }
    await Promise.all([withRefreshLock(task('tab1'), locks), withRefreshLock(task('tab2'), locks)])
    expect(order).toEqual(['tab1:start', 'tab1:end', 'tab2:start', 'tab2:end'])
  })

  it('falls back to running the task directly without Web Locks', async () => {
    await expect(withRefreshLock(async () => 42, undefined)).resolves.toBe(42)
  })
})

describe('createAuthChannel', () => {
  it('delivers logout events to other channel instances (tabs)', async () => {
    const tabA = createAuthChannel('test-auth-channel')
    const tabB = createAuthChannel('test-auth-channel')
    const received: AuthChannelMessage[] = []
    const unsubscribe = tabB.subscribe((message) => received.push(message))
    tabA.post({ type: 'logout' })
    await vi.waitFor(() => expect(received).toEqual([{ type: 'logout' }]))
    unsubscribe()
    tabA.close()
    tabB.close()
  })

  it('ignores unrelated messages on the same channel', async () => {
    const tab = createAuthChannel('test-auth-channel-2')
    const raw = new BroadcastChannel('test-auth-channel-2')
    const received: AuthChannelMessage[] = []
    tab.subscribe((message) => received.push(message))
    raw.postMessage({ type: 'something-else' })
    raw.postMessage({ type: 'session-expired' })
    await vi.waitFor(() => expect(received).toEqual([{ type: 'session-expired' }]))
    raw.close()
    tab.close()
  })
})
