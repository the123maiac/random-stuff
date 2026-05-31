import {
  type ChatChunk,
  type ChatRequest,
  type ModelInfo,
  type ProviderAdapter,
  ProviderError,
  type ProviderType,
  type TokenUsage,
} from './types'
import { readSSE } from './sse'

type FetchLike = typeof fetch

export interface OpenAICompatibleOptions {
  providerType: ProviderType
  baseUrl: string
  apiKey: string
  /** Send stream_options.include_usage. Off for servers that reject it (Ollama). */
  includeUsage?: boolean
  fetchImpl?: FetchLike
}

interface OpenAIStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

type ModelRow = { id?: string; name?: string }
interface ModelListResponse {
  data?: ModelRow[]
  models?: ModelRow[]
}

function mapUsage(u: NonNullable<OpenAIStreamChunk['usage']>): TokenUsage {
  return {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500)
  } catch {
    return res.statusText
  }
}

/**
 * Adapter for any OpenAI-compatible Chat Completions API: OpenAI, Groq,
 * NVIDIA NIM (build.nvidia.com), OpenRouter, Ollama's /v1 endpoint, and any
 * custom base URL.
 */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly providerType: ProviderType
  readonly baseUrl: string
  private readonly apiKey: string
  private readonly includeUsage: boolean
  private readonly fetchImpl: FetchLike

  constructor(opts: OpenAICompatibleOptions) {
    this.providerType = opts.providerType
    this.baseUrl = opts.baseUrl
    this.apiKey = opts.apiKey
    this.includeUsage = opts.includeUsage ?? true
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  async *streamChat(req: ChatRequest): AsyncGenerator<ChatChunk> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: true,
        ...(req.temperature != null ? { temperature: req.temperature } : {}),
        ...(req.maxTokens != null ? { max_tokens: req.maxTokens } : {}),
        ...(this.includeUsage ? { stream_options: { include_usage: true } } : {}),
      }),
      signal: req.signal,
    })

    if (!res.ok || !res.body) {
      throw new ProviderError(this.providerType, res.status, await safeText(res))
    }

    for await (const evt of readSSE(res.body)) {
      const data = evt.data
      if (!data) continue
      if (data === '[DONE]') return
      let chunk: OpenAIStreamChunk
      try {
        chunk = JSON.parse(data) as OpenAIStreamChunk
      } catch {
        continue
      }
      const delta = chunk.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta.length > 0) {
        yield { delta }
      }
      if (chunk.usage) {
        yield { delta: '', usage: mapUsage(chunk.usage) }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) {
      throw new ProviderError(this.providerType, res.status, await safeText(res))
    }
    const json = (await res.json()) as ModelListResponse
    const source: ModelRow[] = json.data ?? json.models ?? []
    return source
      .map((m) => m.id ?? m.name)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map((id) => ({ id }))
  }
}
