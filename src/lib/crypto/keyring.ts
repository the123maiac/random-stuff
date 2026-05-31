import { decryptSecret, encryptSecret } from './envelope'

// Loads the master-key keyring from the environment and provides the
// app-facing encrypt/decrypt helpers. Keeping env parsing here keeps the
// envelope core pure and unit-testable with injected keys.
//
// Env conventions:
//   APP_ENCRYPTION_KEY            -> key version 1 (base64, 32 bytes)
//   APP_ENCRYPTION_KEY_<n>        -> key version n (base64, 32 bytes)
//   APP_ENCRYPTION_KEY_ACTIVE     -> version used for new encryptions
//                                    (defaults to the highest version present)

const KEY_BYTES = 32

export interface Keyring {
  activeVersion: number
  keys: Map<number, Buffer>
}

type Env = Record<string, string | undefined>

function decodeKey(value: string, label: string): Buffer {
  const buf = Buffer.from(value, 'base64')
  if (buf.length !== KEY_BYTES) {
    throw new Error(`${label} must decode to ${KEY_BYTES} bytes (base64), got ${buf.length}`)
  }
  return buf
}

export function loadKeyringFromEnv(env: Env = process.env): Keyring {
  const keys = new Map<number, Buffer>()

  if (env.APP_ENCRYPTION_KEY) {
    keys.set(1, decodeKey(env.APP_ENCRYPTION_KEY, 'APP_ENCRYPTION_KEY'))
  }

  for (const [name, value] of Object.entries(env)) {
    const match = name.match(/^APP_ENCRYPTION_KEY_(\d+)$/)
    if (!match || !value) continue
    const version = Number(match[1])
    if (version === 1 && keys.has(1)) {
      throw new Error('set APP_ENCRYPTION_KEY or APP_ENCRYPTION_KEY_1, not both')
    }
    keys.set(version, decodeKey(value, name))
  }

  if (keys.size === 0) {
    throw new Error(
      'no encryption key configured: set APP_ENCRYPTION_KEY to 32 random bytes, base64-encoded',
    )
  }

  const activeVersion = env.APP_ENCRYPTION_KEY_ACTIVE
    ? Number(env.APP_ENCRYPTION_KEY_ACTIVE)
    : Math.max(...keys.keys())

  if (!Number.isInteger(activeVersion) || !keys.has(activeVersion)) {
    throw new Error(`APP_ENCRYPTION_KEY_ACTIVE=${env.APP_ENCRYPTION_KEY_ACTIVE} has no matching key`)
  }

  return { activeVersion, keys }
}

export interface SealedSecret {
  encryptedKey: string
  keyVersion: number
}

export function sealSecret(plaintext: string, keyring: Keyring): SealedSecret {
  const key = keyring.keys.get(keyring.activeVersion)
  if (!key) throw new Error(`active key version ${keyring.activeVersion} missing from keyring`)
  return {
    encryptedKey: encryptSecret(plaintext, key, keyring.activeVersion),
    keyVersion: keyring.activeVersion,
  }
}

export function openSecret(token: string, keyring: Keyring): string {
  return decryptSecret(token, keyring.keys)
}
