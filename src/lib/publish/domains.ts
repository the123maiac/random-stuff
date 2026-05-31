// DNS label rules: 1-63 chars, alphanumeric or hyphen, no leading/trailing
// hyphen. A hostname is two or more such labels joined by dots, ≤253 chars.
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/

/**
 * Normalizes user input into a bare lowercase hostname, or null if it isn't a
 * usable public hostname. Strips scheme, path, query, port, and a trailing dot;
 * rejects bare labels (no dot), `localhost`, and raw IP-looking input.
 */
export function normalizeHostname(input: string): string | null {
  let h = input.trim().toLowerCase()
  if (!h) return null
  h = h.replace(/^https?:\/\//, '')
  h = h.split('/')[0].split('?')[0].split('#')[0].split(':')[0]
  h = h.replace(/\.$/, '')
  if (h === 'localhost') return null
  if (!HOSTNAME_RE.test(h)) return null
  // Reject dotted-quad IPs — these can't be CNAME'd and aren't valid here.
  if (/^[0-9.]+$/.test(h)) return null
  return h
}

/** The DNS TXT record name a user adds to prove control of `hostname`. */
export const VERIFY_PREFIX = '_vibeship-verify'

export function verificationRecordName(hostname: string): string {
  return `${VERIFY_PREFIX}.${hostname}`
}
