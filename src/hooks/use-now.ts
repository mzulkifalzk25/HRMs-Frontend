import { useEffect, useState } from 'react'

/** Current time, re-rendering every `intervalMs` (default 1 s). Display only; policy uses server time. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
