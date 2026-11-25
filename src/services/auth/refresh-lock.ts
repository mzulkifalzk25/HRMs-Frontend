// Cross-tab refresh coordination (D-079). Refresh tokens rotate and the old one is blacklisted,
// so two tabs refreshing at the same moment could make the second one use a blacklisted token
// and log the user out. The Web Locks API serializes refreshes across tabs of the same origin;
// within one tab the HTTP client already shares a single in-flight refresh.

export const REFRESH_LOCK_NAME = 'formbaxhr:auth-refresh'

type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
}

function defaultLocks(): LockManagerLike | undefined {
  return typeof navigator !== 'undefined' && 'locks' in navigator
    ? (navigator.locks as LockManagerLike)
    : undefined
}

/**
 * Run `task` while holding the cross-tab refresh lock. Falls back to running directly where the
 * Web Locks API is unavailable (old browsers, tests).
 */
export function withRefreshLock<T>(
  task: () => Promise<T>,
  locks: LockManagerLike | undefined = defaultLocks(),
): Promise<T> {
  return locks ? locks.request(REFRESH_LOCK_NAME, task) : task()
}
