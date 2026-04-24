import { describe, it, expect } from 'vitest'
import { hashCredential, createAgentApiKey, hashAgentApiKey } from '../auth'

describe('auth', () => {
  describe('hashCredential', () => {
    it('returns a 64-char hex string (SHA-256)', () => {
      const result = hashCredential('test-value')
      expect(result).toHaveLength(64)
      expect(result).toMatch(/^[0-9a-f]{64}$/)
    })

    it('is deterministic', () => {
      const a = hashCredential('same-input')
      const b = hashCredential('same-input')
      expect(a).toBe(b)
    })

    it('produces different hashes for different inputs', () => {
      const a = hashCredential('input-a')
      const b = hashCredential('input-b')
      expect(a).not.toBe(b)
    })

    it('handles empty string', () => {
      const result = hashCredential('')
      expect(result).toHaveLength(64)
      expect(result).toMatch(/^[0-9a-f]{64}$/)
    })

    it('handles special characters', () => {
      const result = hashCredential('hello 世界 🚀')
      expect(result).toHaveLength(64)
    })
  })

  describe('createAgentApiKey', () => {
    it('starts with agt_ prefix', () => {
      const key = createAgentApiKey()
      expect(key.startsWith('agt_')).toBe(true)
    })

    it('has 48 hex chars after prefix (24 random bytes)', () => {
      const key = createAgentApiKey()
      const hexPart = key.slice(4)
      expect(hexPart).toHaveLength(48)
      expect(hexPart).toMatch(/^[0-9a-f]{48}$/)
    })

    it('generates different keys each call', () => {
      const keys = new Set<string>()
      for (let i = 0; i < 100; i++) {
        keys.add(createAgentApiKey())
      }
      expect(keys.size).toBe(100)  // all unique
    })

    it('total length is 52 (agt_ + 48 hex)', () => {
      const key = createAgentApiKey()
      expect(key).toHaveLength(52)
    })
  })

  describe('hashAgentApiKey', () => {
    it('returns SHA-256 hex', () => {
      const key = createAgentApiKey()
      const hash = hashAgentApiKey(key)
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('is deterministic for same key', () => {
      const key = 'agt_testkey123'
      expect(hashAgentApiKey(key)).toBe(hashAgentApiKey(key))
    })
  })
})
