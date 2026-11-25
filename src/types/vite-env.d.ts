// Types for FormbaxHR's Vite environment variables (see .env.example and src/lib/env.ts).
// Read them through `env` from '@/lib/env', not `import.meta.env` directly.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCK_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
