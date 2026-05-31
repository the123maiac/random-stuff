export type ProviderType =
  | 'openai'
  | 'groq'
  | 'nvidia'
  | 'openrouter'
  | 'ollama'
  | 'custom_openai'
  | 'anthropic'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface ChatChunk {
  /** Incremental text. Empty string is valid (e.g. a usage-only chunk). */
  delta: string
  /** Present on the terminal chunk when the provider reports token usage. */
  usage?: TokenUsage
}

export interface ModelInfo {
  id: string
}

export interface ProviderAdapter {
  readonly providerType: ProviderType
  readonly baseUrl: string
  streamChat(req: ChatRequest): AsyncIterable<ChatChunk>
  listModels(): Promise<ModelInfo[]>
}

/** Thrown when an upstream provider returns a non-2xx response. */
export class ProviderError extends Error {
  constructor(
    readonly providerType: ProviderType,
    readonly status: number,
    readonly detail: string,
  ) {
    super(`${providerType} request failed (${status}): ${detail.slice(0, 500)}`)
    this.name = 'ProviderError'
  }
}
