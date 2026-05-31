import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM envelope encryption for provider API keys.
//
// A secret is stored as a single self-describing token:
//   v1.<keyVersion>.<iv_b64url>.<authTag_b64url>.<ciphertext_b64url>
//
// The keyVersion lets us rotate the master key without re-encrypting
// everything at once: new writes use the active key; reads look up the
// historical key by the version embedded in the token.

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32 // AES-256
const IV_BYTES = 12 // 96-bit nonce, recommended for GCM
const TOKEN_VERSION = 'v1'

const b64 = (buf: Buffer): string => buf.toString('base64url')
const unb64 = (s: string): Buffer => Buffer.from(s, 'base64url')

export function encryptSecret(plaintext: string, key: Buffer, keyVersion: number): string {
  if (key.length !== KEY_BYTES) {
    throw new Error(`master key must be ${KEY_BYTES} bytes, got ${key.length}`)
  }
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error(`keyVersion must be a positive integer, got ${keyVersion}`)
  }
  if (plaintext.length === 0) {
    throw new Error('refusing to encrypt an empty secret')
  }

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [TOKEN_VERSION, String(keyVersion), b64(iv), b64(authTag), b64(ciphertext)].join('.')
}

export function tokenKeyVersion(token: string): number {
  const parts = token.split('.')
  if (parts.length !== 5 || parts[0] !== TOKEN_VERSION) {
    throw new Error('malformed encrypted token')
  }
  const version = Number(parts[1])
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('malformed encrypted token: bad key version')
  }
  return version
}

export function decryptSecret(token: string, keys: Map<number, Buffer>): string {
  const parts = token.split('.')
  if (parts.length !== 5 || parts[0] !== TOKEN_VERSION) {
    throw new Error('malformed encrypted token')
  }
  const [, versionStr, ivB64, tagB64, ctB64] = parts
  const version = Number(versionStr)
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('malformed encrypted token: bad key version')
  }

  const key = keys.get(version)
  if (!key) {
    throw new Error(`no master key available for version ${version}`)
  }

  const decipher = createDecipheriv(ALGORITHM, key, unb64(ivB64))
  decipher.setAuthTag(unb64(tagB64))
  // .final() throws if the auth tag does not verify (tampering / wrong key).
  return Buffer.concat([decipher.update(unb64(ctB64)), decipher.final()]).toString('utf8')
}
