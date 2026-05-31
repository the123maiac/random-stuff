import { describe, it, expect } from 'vitest'
import { decryptSecret, encryptSecret, tokenKeyVersion } from './envelope'

const key1 = Buffer.alloc(32, 1)
const key2 = Buffer.alloc(32, 2)
const keyringV1 = new Map([[1, key1]])

describe('envelope encryption', () => {
  it('round-trips a secret', () => {
    const token = encryptSecret('sk-test-123', key1, 1)
    expect(decryptSecret(token, keyringV1)).toBe('sk-test-123')
  })

  it('produces a versioned, dotted token', () => {
    const token = encryptSecret('hello', key1, 1)
    const parts = token.split('.')
    expect(parts).toHaveLength(5)
    expect(parts[0]).toBe('v1')
    expect(parts[1]).toBe('1')
    expect(tokenKeyVersion(token)).toBe(1)
  })

  it('uses a fresh IV each call, so ciphertext differs', () => {
    const a = encryptSecret('same', key1, 1)
    const b = encryptSecret('same', key1, 1)
    expect(a).not.toBe(b)
    expect(decryptSecret(a, keyringV1)).toBe('same')
    expect(decryptSecret(b, keyringV1)).toBe('same')
  })

  it('rejects a tampered ciphertext (GCM auth failure)', () => {
    const parts = encryptSecret('secret', key1, 1).split('.')
    const ct = Buffer.from(parts[4], 'base64url')
    ct[0] ^= 0xff
    parts[4] = ct.toString('base64url')
    expect(() => decryptSecret(parts.join('.'), keyringV1)).toThrow()
  })

  it('rejects decryption with the wrong key', () => {
    const token = encryptSecret('secret', key1, 1)
    expect(() => decryptSecret(token, new Map([[1, key2]]))).toThrow()
  })

  it('throws when no key matches the token version', () => {
    const token = encryptSecret('secret', key2, 2)
    expect(() => decryptSecret(token, keyringV1)).toThrow(/version 2/)
  })

  it('rejects a wrong-size master key', () => {
    expect(() => encryptSecret('x', Buffer.alloc(16, 1), 1)).toThrow(/32 bytes/)
  })

  it('rejects empty plaintext', () => {
    expect(() => encryptSecret('', key1, 1)).toThrow(/empty/)
  })

  it('rejects malformed tokens', () => {
    expect(() => decryptSecret('not-a-token', keyringV1)).toThrow(/malformed/)
    expect(() => tokenKeyVersion('a.b.c')).toThrow(/malformed/)
  })
})
