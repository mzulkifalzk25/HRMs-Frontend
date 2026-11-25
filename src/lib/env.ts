// Typed, validated environment configuration (P1-T09, D-025).
//
// Rules (D-076):
// - Invalid values always fail with a clear error.
// - Missing values fall back to documented defaults ONLY outside production builds,
//   so a fresh clone runs with `pnpm dev`. A production build with missing values fails:
//   it must never silently fall back to mock data or a localhost API.
// - Values are public (bundled into the client). Never put secrets in VITE_* variables.
import { z } from 'zod'

export const ENV_DEFAULTS = {
  VITE_API_BASE_URL: 'http://localhost:8000/api/v1',
  VITE_USE_MOCK_API: 'true',
} as const

export type EnvKey = keyof typeof ENV_DEFAULTS

export type AppEnv = {
  /** API base URL without a trailing slash, e.g. `http://localhost:8000/api/v1`. */
  apiBaseUrl: string
  /** `true` when the app uses mock services instead of the Django API. */
  useMockApi: boolean
  /** Keys that were missing and replaced by ENV_DEFAULTS (development/test only). */
  usedDefaults: EnvKey[]
}

export class EnvError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}\n` +
        'See .env.example for the expected variables.',
    )
    this.name = 'EnvError'
    this.issues = issues
  }
}

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .pipe(z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }))
    .transform((url) => url.replace(/\/+$/, '')),
  VITE_USE_MOCK_API: z
    .string()
    .trim()
    .pipe(z.enum(['true', 'false'], { error: 'must be exactly "true" or "false"' }))
    .transform((value) => value === 'true'),
})

function isMissing(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.trim() === '')
}

/** Pure parser (exported for tests). `source` is usually `import.meta.env`. */
export function parseEnv(
  source: Record<string, unknown>,
  options: { isProduction: boolean },
): AppEnv {
  const keys = Object.keys(ENV_DEFAULTS) as EnvKey[]
  const missing = keys.filter((key) => isMissing(source[key]))

  if (options.isProduction && missing.length > 0) {
    throw new EnvError(missing.map((key) => `${key}: is required in production builds`))
  }

  const input: Record<EnvKey, unknown> = { ...ENV_DEFAULTS }
  for (const key of keys) {
    if (!missing.includes(key)) input[key] = source[key]
  }

  const result = envSchema.safeParse(input)
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    )
  }

  return {
    apiBaseUrl: result.data.VITE_API_BASE_URL,
    useMockApi: result.data.VITE_USE_MOCK_API,
    usedDefaults: missing,
  }
}

/** Application environment, validated once at startup. */
export const env: AppEnv = parseEnv(import.meta.env, { isProduction: import.meta.env.PROD })

if (import.meta.env.MODE === 'development' && env.usedDefaults.length > 0) {
  console.warn(
    `[FormbaxHR] Using default values for ${env.usedDefaults.join(', ')}. ` +
      'Copy .env.example to .env.local to configure them explicitly.',
  )
}
