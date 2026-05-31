import { AnthropicAdapter } from './anthropic'
import { OpenAICompatibleAdapter } from './openai-compatible'
import { type ProviderAdapter, type ProviderType } from './types'

export interface ProviderMeta {
  type: ProviderType
  label: string
  /** API shape. `custom`/`ollama` reuse the openai shape with a user base URL. */
  kind: 'openai' | 'anthropic'
  /** null => the user must supply a base URL (custom, self-hosted). */
  defaultBaseUrl: string | null
  baseUrlEditable: boolean
  /** Some OpenAI-compatible servers reject stream_options.include_usage. */
  includeUsage: boolean
  keyHelp: string
}

export const PROVIDERS: Record<ProviderType, ProviderMeta> = {
  openai: {
    type: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    baseUrlEditable: false,
    includeUsage: true,
    keyHelp: 'platform.openai.com/api-keys',
  },
  anthropic: {
    type: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    baseUrlEditable: false,
    includeUsage: true,
    keyHelp: 'console.anthropic.com/settings/keys',
  },
  groq: {
    type: 'groq',
    label: 'Groq',
    kind: 'openai',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    baseUrlEditable: false,
    includeUsage: true,
    keyHelp: 'console.groq.com/keys',
  },
  nvidia: {
    type: 'nvidia',
    label: 'NVIDIA NIM',
    kind: 'openai',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    baseUrlEditable: false,
    includeUsage: true,
    keyHelp: 'build.nvidia.com (API Keys)',
  },
  openrouter: {
    type: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    baseUrlEditable: false,
    includeUsage: true,
    keyHelp: 'openrouter.ai/keys',
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama',
    kind: 'openai',
    // Hosted servers cannot reach a user's localhost, so this must point at a
    // publicly reachable Ollama (tunnel / LAN host the server can resolve).
    defaultBaseUrl: 'http://localhost:11434/v1',
    baseUrlEditable: true,
    includeUsage: false,
    keyHelp: 'any non-empty value (Ollama ignores the key)',
  },
  custom_openai: {
    type: 'custom_openai',
    label: 'Custom (OpenAI-compatible)',
    kind: 'openai',
    defaultBaseUrl: null,
    baseUrlEditable: true,
    includeUsage: true,
    keyHelp: 'your endpoint API key',
  },
}

export interface CreateAdapterParams {
  providerType: ProviderType
  apiKey: string
  /** Overrides the provider default; required when the default is null. */
  baseUrl?: string | null
  fetchImpl?: typeof fetch
}

export function resolveBaseUrl(providerType: ProviderType, baseUrl?: string | null): string {
  const meta = PROVIDERS[providerType]
  if (!meta) throw new Error(`unknown provider: ${providerType}`)
  const chosen = (baseUrl ?? meta.defaultBaseUrl)?.trim()
  if (!chosen) throw new Error(`${meta.label} requires a base URL`)
  return chosen.replace(/\/+$/, '')
}

export function createAdapter(params: CreateAdapterParams): ProviderAdapter {
  const meta = PROVIDERS[params.providerType]
  if (!meta) throw new Error(`unknown provider: ${params.providerType}`)
  const baseUrl = resolveBaseUrl(params.providerType, params.baseUrl)

  if (meta.kind === 'anthropic') {
    return new AnthropicAdapter({ baseUrl, apiKey: params.apiKey, fetchImpl: params.fetchImpl })
  }
  return new OpenAICompatibleAdapter({
    providerType: params.providerType,
    baseUrl,
    apiKey: params.apiKey,
    includeUsage: meta.includeUsage,
    fetchImpl: params.fetchImpl,
  })
}
