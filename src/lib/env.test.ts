import { describe, expect, it } from 'vitest'
import { ENV_DEFAULTS, EnvError, parseEnv } from './env'

const dev = { isProduction: false }
const prod = { isProduction: true }

function parseError(source: Record<string, unknown>, options = dev): EnvError {
  try {
    parseEnv(source, options)
  } catch (error) {
    if (error instanceof EnvError) return error
    throw error
  }
  throw new Error('expected parseEnv to throw EnvError')
}

describe('parseEnv', () => {
  describe('valid values', () => {
    it('parses the documented example values', () => {
      expect(
        parseEnv(
          { VITE_API_BASE_URL: 'http://localhost:8000/api/v1', VITE_USE_MOCK_API: 'true' },
          dev,
        ),
      ).toEqual({ apiBaseUrl: 'http://localhost:8000/api/v1', useMockApi: true, usedDefaults: [] })
    })

    it('parses "false" as real API mode and accepts https', () => {
      const env = parseEnv(
        { VITE_API_BASE_URL: 'https://hr.example.test/api/v1', VITE_USE_MOCK_API: 'false' },
        prod,
      )
      expect(env.useMockApi).toBe(false)
      expect(env.apiBaseUrl).toBe('https://hr.example.test/api/v1')
    })

    it('trims whitespace and removes trailing slashes from the base URL', () => {
      const env = parseEnv(
        { VITE_API_BASE_URL: '  http://localhost:8000/api/v1//  ', VITE_USE_MOCK_API: ' false ' },
        dev,
      )
      expect(env.apiBaseUrl).toBe('http://localhost:8000/api/v1')
      expect(env.useMockApi).toBe(false)
    })
  })

  describe('missing values', () => {
    it('uses documented defaults outside production and reports which keys defaulted', () => {
      expect(parseEnv({}, dev)).toEqual({
        apiBaseUrl: ENV_DEFAULTS.VITE_API_BASE_URL,
        useMockApi: true,
        usedDefaults: ['VITE_API_BASE_URL', 'VITE_USE_MOCK_API'],
      })
    })

    it('treats empty strings as missing', () => {
      const env = parseEnv({ VITE_API_BASE_URL: '   ', VITE_USE_MOCK_API: 'false' }, dev)
      expect(env.usedDefaults).toEqual(['VITE_API_BASE_URL'])
      expect(env.useMockApi).toBe(false)
    })

    it('fails in production when any value is missing, naming every missing key', () => {
      const error = parseError({ VITE_USE_MOCK_API: 'false' }, prod)
      expect(error.issues).toEqual(['VITE_API_BASE_URL: is required in production builds'])

      const both = parseError({}, prod)
      expect(both.issues).toHaveLength(2)
      expect(both.message).toContain('VITE_USE_MOCK_API')
      expect(both.message).toContain('.env.example')
    })
  })

  describe('invalid values (fail in every mode)', () => {
    it.each(['yes', '1', 'TRUE', 'on', 'mock'])('rejects VITE_USE_MOCK_API=%j', (value) => {
      const error = parseError({
        VITE_API_BASE_URL: 'http://localhost:8000',
        VITE_USE_MOCK_API: value,
      })
      expect(error.issues).toEqual(['VITE_USE_MOCK_API: must be exactly "true" or "false"'])
    })

    it.each(['not a url', 'localhost:8000/api', 'ftp://files.example.test', 'javascript:alert(1)'])(
      'rejects VITE_API_BASE_URL=%j',
      (value) => {
        const error = parseError({ VITE_API_BASE_URL: value, VITE_USE_MOCK_API: 'true' }, prod)
        expect(error.issues).toEqual(['VITE_API_BASE_URL: must be an http(s) URL'])
      },
    )

    it('reports all invalid values together', () => {
      const error = parseError({ VITE_API_BASE_URL: 'nope', VITE_USE_MOCK_API: 'nope' })
      expect(error.issues).toHaveLength(2)
    })
  })
})
