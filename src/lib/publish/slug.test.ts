import { describe, expect, it } from 'vitest'
import { generateSlug, slugFromBytes } from './slug'

describe('slugFromBytes', () => {
  it('maps every byte into the alphabet deterministically', () => {
    const out = slugFromBytes(new Uint8Array([0, 1, 2, 31, 32, 33]))
    // alphabet length is 31, so 31 -> index 0, 32 -> index 1, 33 -> index 2
    expect(out).toBe('234234')
  })

  it('only emits unambiguous lowercase characters', () => {
    const bytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) bytes[i] = i
    const out = slugFromBytes(bytes)
    expect(out).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]+$/)
    expect(out).not.toMatch(/[01ilo]/)
  })

  it('produces one character per input byte', () => {
    expect(slugFromBytes(new Uint8Array(7))).toHaveLength(7)
  })
})

describe('generateSlug', () => {
  it('defaults to 12 characters', () => {
    expect(generateSlug()).toHaveLength(12)
  })

  it('honours a custom length and is effectively unique', () => {
    const a = generateSlug(16)
    const b = generateSlug(16)
    expect(a).toHaveLength(16)
    expect(a).not.toBe(b)
  })
})
