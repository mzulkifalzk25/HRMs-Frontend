import { useSyncExternalStore } from 'react'

/** Browser connectivity (navigator.onLine). Treated as online where unknown. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange)
      window.addEventListener('offline', onChange)
      return () => {
        window.removeEventListener('online', onChange)
        window.removeEventListener('offline', onChange)
      }
    },
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    () => true,
  )
}
