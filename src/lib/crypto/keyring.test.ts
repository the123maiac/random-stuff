import { describe, it, expect } from 'vitest'
import { loadKeyringFromEnv, openSecret, sealSecret } from './keyring'

const k1 = Buffer.alloc(32, 1).toString('base64')
const k2 = Buffer.alloc(32, 2).toString('base64')

describe('keyring', () => {
  it('loads APP_ENCRYPTION_KEY as version 1', () => {
    const kr = loadKeyringFromEnv({ APP_ENCRYPTION_KEY: k1 })
    expect(kr.activeVersion).toBe(1)
    expect(kr.keys.size).toBe(1)
  })

  it('loads multiple versions and respects APP_ENCRYPTION_KEY_ACTIVE', () => {
    const kr = loadKeyringFromEnv({
      APP_ENCRYPTION_KEY: k1,
      APP_ENCRYPTION_KEY_2: k2,
      APP_ENCRYPTION_KEY_ACTIVE: '2',
    })
    expect(kr.activeVersion).toBe(2)
    expect(kr.keys.size).toBe(2)
  })

  it('defaults the active version to the highest present', () => {
    const kr = loadKeyringFromEnv({ APP_ENCRYPTION_KEY: k1, APP_ENCRYPTION_KEY_2: k2 })
    expect(kr.activeVersion).toBe(2)
  })

  it('throws when no key is configured', () => {
    expect(() => loadKeyringFromEnv({})).toThrow(/no encryption key/)
  })

  it('throws on a wrong-size key', () => {
    expect(() =>
      loadKeyringFromEnv({ APP_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') }),
    ).toThrow(/32 bytes/)
  })

  it('throws when the active version has no key', () => {
    expect(() =>
      loadKeyringFromEnv({ APP_ENCRYPTION_KEY: k1, APP_ENCRYPTION_KEY_ACTIVE: '5' }),
    ).toThrow(/no matching key/)
  })

  it('seals under the active key and still opens after rotation', () => {
    const krV1 = loadKeyringFromEnv({ APP_ENCRYPTION_KEY: k1 })
    const sealed = sealSecret('sk-rotate-me', krV1)
    expect(sealed.keyVersion).toBe(1)

    // Rotate: v2 becomes active, but v1 is retained to read old rows.
    const krBoth = loadKeyringFromEnv({
      APP_ENCRYPTION_KEY: k1,
      APP_ENCRYPTION_KEY_2: k2,
      APP_ENCRYPTION_KEY_ACTIVE: '2',
    })
    expect(openSecret(sealed.encryptedKey, krBoth)).toBe('sk-rotate-me')

    const fresh = sealSecret('new-secret', krBoth)
    expect(fresh.keyVersion).toBe(2)
    expect(openSecret(fresh.encryptedKey, krBoth)).toBe('new-secret')
  })
})
