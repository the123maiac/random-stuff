import 'server-only'
import { loadKeyringFromEnv, type Keyring } from './keyring'

let cached: Keyring | undefined

/** Parses the master keyring from env once per process and reuses it. */
export function getKeyring(): Keyring {
  if (!cached) cached = loadKeyringFromEnv()
  return cached
}
