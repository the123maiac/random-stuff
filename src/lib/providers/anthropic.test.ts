import { describe, it, expect } from 'vitest'
import { AnthropicAdapter } from './anthropic'
import { ProviderError, type ChatChunk } from './types'

function streamResponse(body: string, status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(body))
      c.close()
    },
  })
  return new Response(stream, { status })
}

async function collect(it: AsyncIterable<ChatChunk>) {
  let text = ''
  let usage: ChatChunk['usage']
  for await (const c of it) {
    text += c.delta
    if (c.usage) usage = c.usage
  }
  return { text, usage }
}

describe('AnthropicAdapter', () => {
  it('streams text deltas and maps prompt/completion usage', async () => {
    const body =
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":11}}}\n\n' +
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi "}}\n\n' +
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"there"}}\n\n' +
      'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":4}}\n\n'
    const fetchImpl = (async () => streamResponse(body)) as unknown as typeof fetch
    const a = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.com', apiKey: 'k', fetchImpl })
    const out = await collect(a.streamChat({ model: 'claude', messages: [{ role: 'user', content: 'hi' }] }))
    expect(out.text).toBe('Hi there')
    expect(out.usage).toEqual({ promptTokens: 11, completionTokens: 4 })
  })

  it('hoists system messages into the top-level system field', async () => {
    let reqBody: { system?: string; messages?: Array<{ role: string }>; max_tokens?: number } | undefined
    const headers: Record<string, string> = {}
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      reqBody = JSON.parse((init?.body as string) ?? '{}')
      Object.assign(headers, init?.headers as Record<string, string>)
      return streamResponse('event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":0}}\n\n')
    }) as unknown as typeof fetch
    const a = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.com', apiKey: 'secret', fetchImpl })
    await collect(
      a.streamChat({
        model: 'claude',
        messages: [
          { role: 'system', content: 'be terse' },
          { role: 'system', content: 'be kind' },
          { role: 'user', content: 'hi' },
        ],
      }),
    )
    expect(reqBody?.system).toBe('be terse\n\nbe kind')
    expect(reqBody?.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(headers['x-api-key']).toBe('secret')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })

  it('defaults max_tokens to 1024 and omits system when none present', async () => {
    let reqBody: { max_tokens?: number; system?: string } | undefined
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      reqBody = JSON.parse((init?.body as string) ?? '{}')
      return streamResponse('event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":0}}\n\n')
    }) as unknown as typeof fetch
    const a = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.com', apiKey: 'k', fetchImpl })
    await collect(a.streamChat({ model: 'claude', messages: [{ role: 'user', content: 'hi' }] }))
    expect(reqBody?.max_tokens).toBe(1024)
    expect(reqBody?.system).toBeUndefined()
  })

  it('throws ProviderError on a non-2xx response', async () => {
    const fetchImpl = (async () => streamResponse('bad key', 401)) as unknown as typeof fetch
    const a = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.com', apiKey: 'bad', fetchImpl })
    await expect(collect(a.streamChat({ model: 'claude', messages: [] }))).rejects.toBeInstanceOf(ProviderError)
  })

  it('throws ProviderError when the stream emits an error event', async () => {
    const body = 'event: error\ndata: {"type":"error","error":{"message":"overloaded"}}\n\n'
    const fetchImpl = (async () => streamResponse(body)) as unknown as typeof fetch
    const a = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.com', apiKey: 'k', fetchImpl })
    await expect(collect(a.streamChat({ model: 'claude', messages: [] }))).rejects.toBeInstanceOf(ProviderError)
  })

  it('lists models from a data[] payload', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: [{ id: 'claude-opus-4' }, { id: 'claude-sonnet-4' }] }), {
        status: 200,
      })) as unknown as typeof fetch
    const a = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.com', apiKey: 'k', fetchImpl })
    const models = await a.listModels()
    expect(models.map((m) => m.id)).toEqual(['claude-opus-4', 'claude-sonnet-4'])
  })
})
