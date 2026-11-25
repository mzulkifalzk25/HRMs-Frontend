// Vitest setup: DOM matchers (toBeInTheDocument, toHaveAccessibleName, ...) and
// DOM cleanup between tests (needed because Vitest globals are not enabled).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
