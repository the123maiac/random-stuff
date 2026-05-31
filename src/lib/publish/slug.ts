// Crockford-ish alphabet: lowercase, no vowels-that-form-words risk, and no
// ambiguous glyphs (0/o, 1/l/i). Keeps public URLs short and unguessable.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

/** Maps each byte into the alphabet. Pure — injectable bytes make it testable. */
export function slugFromBytes(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

/** A random slug for a published site. 12 chars ≈ 60 bits of entropy. */
export function generateSlug(length = 12): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return slugFromBytes(bytes)
}
