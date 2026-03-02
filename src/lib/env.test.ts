import { describe, it, expect } from 'vitest'

describe('env', () => {
  it('exports expected client env constants', async () => {
    // Dynamic import to get the module's exports.
    // In the test env, import.meta.env.PROD is false, so validateClientEnv
    // is a no-op and placeholder credentials are accepted.
    const env = await import('./env')

    expect(typeof env.SUPABASE_URL).toBe('string')
    expect(typeof env.SUPABASE_ANON_KEY).toBe('string')
    expect(typeof env.IS_CI_BUILD).toBe('boolean')
    expect(typeof env.OBS_ENABLED).toBe('boolean')
    expect(typeof env.OBS_SAMPLE_RATE).toBe('number')
    expect(env.OBS_SAMPLE_RATE).toBeGreaterThanOrEqual(0)
    expect(env.OBS_SAMPLE_RATE).toBeLessThanOrEqual(1)
    expect(typeof env.TURNSTILE_SITE_KEY).toBe('string')
    expect(typeof env.DIAGNOSTICS_UI_ENABLED).toBe('boolean')
    expect(typeof env.LLM_API_KEY).toBe('string')
    expect(typeof env.isPlaceholderCredentials).toBe('boolean')
    expect(typeof env.validateClientEnv).toBe('function')
  })

  it('validateClientEnv is a no-op in non-production', async () => {
    const env = await import('./env')
    // Should not throw in test (non-production) environment
    expect(() => env.validateClientEnv()).not.toThrow()
  })
})
