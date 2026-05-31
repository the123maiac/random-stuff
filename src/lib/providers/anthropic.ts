import {
  type ChatChunk,
  type ChatRequest,
  type ModelInfo,
  type ProviderAdapter,
  ProviderError,
  type TokenUsage,
} from './types'
import { readSSE } from './sse'

type FetchLike = typeof fetch

const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MAX_TOKENS = 1024

export interface AnthropicOptions {
  baseUrl: string
  apiKey: string
  fetchImpl?: FetchLike
}

interface AnthropicEvent {
  type?: string
  delta?: { type?: string; text?: string }
  message?: { usage?: { input_tokens?: number } }
  usage?: { output_tokens?: number }
  error?: { message?: string }
}

interface AnthropicModelList {
  data?: Array<{ id?: string }>
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500)
  } catch {
    return res.statusText
  }
}

/**
 * Adapter for Anthropic's Messages API. System messages are hoisted out of
 * the message list into the top-level `system` field, as the API requires.
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly providerType = 'anthropic' as const
  readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: FetchLike

  constructor(opts: AnthropicOptions) {
    this.baseUrl = opts.baseUrl
    this.apiKey = opts.apiKey
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  async *streamChat(req: ChatRequest): AsyncGenerator<ChatChunk> {
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages,
        stream: true,
        ...(system.length > 0 ? { system } : {}),
        ...(req.temperature != null ? { temperature: req.temperature } : {}),
      }),
      signal: req.signal,
    })

    if (!res.ok || !res.body) {
      throw new ProviderError('anthropic', res.status, await safeText(res))
    }

    let promptTokens: number | undefined
    for await (const evt of readSSE(res.body)) {
      if (!evt.data) continue
      let payload: AnthropicEvent
      try {
        payload = JSON.parse(evt.data) as AnthropicEvent
      } catch {
        continue
      }
      const type = payload.type ?? evt.event
      if (type === 'message_start') {
        promptTokens = payload.message?.usage?.input_tokens
      } else if (type === 'content_block_delta') {
        const text = payload.delta?.text
        if (typeof text === 'string' && text.length > 0) yield { delta: text }
      } else if (type === 'message_delta') {
        const usage: TokenUsage = {
          promptTokens,
          completionTokens: payload.usage?.output_tokens,
        }
        yield { delta: '', usage }
      } else if (type === 'error') {
        throw new ProviderError('anthropic', 502, payload.error?.message ?? 'stream error')
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/models`, {
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    })
    if (!res.ok) {
      throw new ProviderError('anthropic', res.status, await safeText(res))
    }
    const json = (await res.json()) as AnthropicModelList
    return (json.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map((id) => ({ id }))
  }
}
