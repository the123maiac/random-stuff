import { describe, it, expect } from 'vitest'
import { PROVIDERS, resolveBaseUrl, createAdapter } from './registry'
import { OpenAICompatibleAdapter } from './openai-compatible'
import { AnthropicAdapter } from './anthropic'
import type { ProviderType } from './types'

const ALL_TYPES: ProviderType[] = [
  'openai',
  'groq',
  'nvidia',
  'openrouter',
  'ollama',
  'custom_openai',
  'anthropic',
]

describe('PROVIDERS metadata', () => {
  it('has an entry keyed correctly for every provider type', () => {
    for (const t of ALL_TYPES) {
      expect(PROVIDERS[t]).toBeDefined()
      expect(PROVIDERS[t].type).toBe(t)
      expect(PROVIDERS[t].label.length).toBeGreaterThan(0)
    }
  })

  it('only anthropic uses the anthropic kind', () => {
    const anthropicKinds = ALL_TYPES.filter((t) => PROVIDERS[t].kind === 'anthropic')
    expect(anthropicKinds).toEqual(['anthropic'])
  })

  it('marks editable-base-url providers consistently', () => {
    expect(PROVIDERS.ollama.baseUrlEditable).toBe(true)
    expect(PROVIDERS.custom_openai.baseUrlEditable).toBe(true)
    expect(PROVIDERS.custom_openai.defaultBaseUrl).toBeNull()
    expect(PROVIDERS.openai.baseUrlEditable).toBe(false)
  })

  it('disables usage reporting only for ollama', () => {
    expect(PROVIDERS.ollama.includeUsage).toBe(false)
    expect(PROVIDERS.openai.includeUsage).toBe(true)
  })
})

describe('resolveBaseUrl', () => {
  it('falls back to the provider default', () => {
    expect(resolveBaseUrl('groq')).toBe('https://api.groq.com/openai/v1')
  })

  it('trims trailing slashes from the chosen url', () => {
    expect(resolveBaseUrl('openai', 'https://proxy.example/v1///')).toBe('https://proxy.example/v1')
  })

  it('throws when a custom provider is given no base url', () => {
    expect(() => resolveBaseUrl('custom_openai')).toThrow()
  })

  it('throws for an unknown provider type', () => {
    expect(() => resolveBaseUrl('nope' as ProviderType)).toThrow()
  })
})

describe('createAdapter', () => {
  it('builds an OpenAI-compatible adapter for groq with the default base url', () => {
    const a = createAdapter({ providerType: 'groq', apiKey: 'k' })
    expect(a).toBeInstanceOf(OpenAICompatibleAdapter)
    expect(a.providerType).toBe('groq')
    expect(a.baseUrl).toBe('https://api.groq.com/openai/v1')
  })

  it('builds an Anthropic adapter for anthropic', () => {
    const a = createAdapter({ providerType: 'anthropic', apiKey: 'k' })
    expect(a).toBeInstanceOf(AnthropicAdapter)
    expect(a.providerType).toBe('anthropic')
  })

  it('honors a user-supplied base url for custom providers', () => {
    const a = createAdapter({ providerType: 'custom_openai', apiKey: 'k', baseUrl: 'https://my.host/v1/' })
    expect(a).toBeInstanceOf(OpenAICompatibleAdapter)
    expect(a.baseUrl).toBe('https://my.host/v1')
  })

  it('throws when a custom provider has no base url', () => {
    expect(() => createAdapter({ providerType: 'custom_openai', apiKey: 'k' })).toThrow()
  })
})
