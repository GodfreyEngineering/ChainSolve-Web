import { describe, it, expect } from 'vitest'
import { validateStoragePath, assertSafeStoragePath } from './validateStoragePath'

describe('validateStoragePath — valid paths', () => {
  it('accepts a normal project.json path', () => {
    expect(validateStoragePath('abc123/proj456/project.json').ok).toBe(true)
  })

  it('accepts a uuid-based canvas path', () => {
    const p =
      'a1b2c3d4-1234-1234-1234-abcdef012345/' +
      'b2c3d4e5-5678-5678-5678-bcdef0123456/' +
      'canvases/c3d4e5f6-9abc-9abc-9abc-cdef01234567.json'
    expect(validateStoragePath(p).ok).toBe(true)
  })

  it('accepts an upload path with timestamp', () => {
    const p = 'uid/pid/uploads/1700000000000_my_data.csv'
    expect(validateStoragePath(p).ok).toBe(true)
  })

  it('accepts a path with dots in filename (not traversal)', () => {
    expect(validateStoragePath('uid/pid/uploads/file.v2.csv').ok).toBe(true)
  })

  it('accepts a single dot in filename', () => {
    expect(validateStoragePath('uid/pid/file.json').ok).toBe(true)
  })
})

describe('validateStoragePath — traversal attacks', () => {
  it('rejects ../ at start', () => {
    const r = validateStoragePath('../etc/passwd')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/traversal/)
  })

  it('rejects embedded ../', () => {
    const r = validateStoragePath('uid/pid/../../other.json')
    expect(r.ok).toBe(false)
  })

  it('rejects /.. at end', () => {
    const r = validateStoragePath('uid/pid/..')
    expect(r.ok).toBe(false)
  })

  it('rejects just ".."', () => {
    expect(validateStoragePath('..').ok).toBe(false)
  })

  it('rejects URL-encoded dot-dot %2e%2e', () => {
    const r = validateStoragePath('%2e%2e/etc/passwd')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/encoded/)
  })

  it('rejects double-encoded %252e%252e', () => {
    const r = validateStoragePath('%252e%252e/secret')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/encoded/)
  })

  it('rejects single-encoded traversal that decodes to ../', () => {
    // "uid%2Fpid%2F..%2Fother.json" decodes to "uid/pid/../other.json"
    // (the %2F decodes to / but the .. segment is still there)
    // Note: this also tests the decoded-path check
    const r = validateStoragePath('uid/pid/%2e%2e/other.json')
    expect(r.ok).toBe(false)
  })
})

describe('validateStoragePath — null bytes', () => {
  it('rejects raw null byte', () => {
    const r = validateStoragePath('uid/pid/file\x00.json')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/null byte/)
  })

  it('rejects %00', () => {
    const r = validateStoragePath('uid/pid/file%00.json')
    expect(r.ok).toBe(false)
  })
})

describe('validateStoragePath — other invalid inputs', () => {
  it('rejects empty string', () => {
    const r = validateStoragePath('')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/empty/)
  })

  it('rejects backslash', () => {
    const r = validateStoragePath('uid\\pid\\file.json')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/backslash/)
  })

  it('rejects malformed percent-encoding', () => {
    const r = validateStoragePath('uid/pid/file%ZZtest.json')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/malformed/)
  })
})

describe('assertSafeStoragePath', () => {
  it('does not throw for a safe path', () => {
    expect(() => assertSafeStoragePath('uid/pid/project.json')).not.toThrow()
  })

  it('throws for a traversal path', () => {
    expect(() => assertSafeStoragePath('../etc/passwd')).toThrow(/Rejected/)
  })

  it('throws for empty string', () => {
    expect(() => assertSafeStoragePath('')).toThrow(/Rejected/)
  })
})
