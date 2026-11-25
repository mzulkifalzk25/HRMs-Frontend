// Cross-tab auth events: when one tab logs out (or its session expires), every other tab of the
// app clears its in-memory session too, so no tab keeps showing HR data after logout.

export const AUTH_CHANNEL_NAME = 'formbaxhr:auth'

export type AuthChannelMessage = { type: 'logout' } | { type: 'session-expired' }

export type AuthChannel = {
  post(message: AuthChannelMessage): void
  subscribe(listener: (message: AuthChannelMessage) => void): () => void
  close(): void
}

function isAuthMessage(value: unknown): value is AuthChannelMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value.type === 'logout' || value.type === 'session-expired')
  )
}

/** BroadcastChannel-based channel; a no-op where BroadcastChannel is unavailable. */
export function createAuthChannel(name = AUTH_CHANNEL_NAME): AuthChannel {
  if (typeof BroadcastChannel === 'undefined') {
    return { post() {}, subscribe: () => () => {}, close() {} }
  }
  const channel = new BroadcastChannel(name)
  return {
    post(message) {
      channel.postMessage(message)
    },
    subscribe(listener) {
      const handler = (event: MessageEvent<unknown>) => {
        if (isAuthMessage(event.data)) listener(event.data)
      }
      channel.addEventListener('message', handler)
      return () => channel.removeEventListener('message', handler)
    },
    close() {
      channel.close()
    },
  }
}
