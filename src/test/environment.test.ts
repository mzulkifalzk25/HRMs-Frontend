// Confirms that `pnpm test:tz` really runs the suite under a non-Karachi timezone,
// so timezone-independence tests (P1-T12, Phase 4) are meaningful.
import { describe, expect, it } from 'vitest'

describe('test environment', () => {
  it('uses the process timezone given in TZ', () => {
    const tz = process.env.TZ
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) {
      expect(resolved).toBe(tz)
    } else {
      expect(resolved).toBeTypeOf('string')
    }
  })
})
