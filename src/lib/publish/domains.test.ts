import { describe, expect, it } from 'vitest'
import { normalizeHostname, verificationRecordName } from './domains'

describe('normalizeHostname', () => {
  it('lowercases and trims', () => {
    expect(normalizeHostname('  App.Example.COM ')).toBe('app.example.com')
  })

  it('strips scheme, port, path, query, hash, and trailing dot', () => {
    expect(normalizeHostname('https://app.example.com:443/path?x=1#y')).toBe('app.example.com')
    expect(normalizeHostname('app.example.com.')).toBe('app.example.com')
  })

  it('accepts multi-label subdomains', () => {
    expect(normalizeHostname('shop.eu.example.co.uk')).toBe('shop.eu.example.co.uk')
  })

  it('rejects bare labels, localhost, IPs, and junk', () => {
    expect(normalizeHostname('example')).toBeNull()
    expect(normalizeHostname('localhost')).toBeNull()
    expect(normalizeHostname('127.0.0.1')).toBeNull()
    expect(normalizeHostname('')).toBeNull()
    expect(normalizeHostname('has space.com')).toBeNull()
    expect(normalizeHostname('-bad.example.com')).toBeNull()
    expect(normalizeHostname('bad-.example.com')).toBeNull()
  })
})

describe('verificationRecordName', () => {
  it('prefixes the verification subdomain', () => {
    expect(verificationRecordName('app.example.com')).toBe('_vibeship-verify.app.example.com')
  })
})
