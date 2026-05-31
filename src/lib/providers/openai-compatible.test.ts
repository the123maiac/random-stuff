import { describe, it, expect } from 'vitest'
import { OpenAICompatibleAdapter } from './openai-compatible'
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

describe('OpenAICompatibleAdapter', () => {
  it('streams content deltas and final usage', async () => {
    const body =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
      'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n' +
      'data: [DONE]\n\n'
    const fetchImpl = (async () => streamResponse(body)) as unknown as typeof fetch
    const a = new OpenAICompatibleAdapter({ providerType: 'openai', baseUrl: 'https://x/v1', apiKey: 'k', fetchImpl })
    const out = await collect(a.streamChat({ model: 'gpt', messages: [{ role: 'user', content: 'hi' }] }))
    expect(out.text).toBe('Hello')
    expect(out.usage).toEqual({ promptTokens: 5, completionTokens: 2, totalTokens: 7 })
  })

  it('sends stream:true + bearer auth and reassembles split events', async () => {
    let captured: { url: string; init: RequestInit } | undefined
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(input), init: init ?? {} }
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          const enc = new TextEncoder()
          c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"par'))
          c.enqueue(enc.encode('tial"}}]}\n\ndata: [DONE]\n\n'))
          c.close()
        },
      })
      return new Response(stream, { status: 200 })
    }) as unknown as typeof fetch
    const a = new OpenAICompatibleAdapter({ providerType: 'openai', baseUrl: 'https://x/v1', apiKey: 'secret', fetchImpl })
    const out = await collect(a.streamChat({ model: 'gpt', messages: [{ role: 'user', content: 'hi' }] }))
    expect(out.text).toBe('partial')
    expect(captured?.url).toBe('https://x/v1/chat/completions')
    const headers = captured?.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer secret')
    const reqBody = JSON.parse(captured?.init.body as string)
    expect(reqBody.stream).toBe(true)
    expect(reqBody.model).toBe('gpt')
    expect(reqBody.stream_options).toEqual({ include_usage: true })
  })

  it('omits stream_options when includeUsage is false (Ollama)', async () => {
    let reqBody: { stream_options?: unknown } | undefined
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      reqBody = JSON.parse((init?.body as string) ?? '{}')
      return streamResponse('data: [DONE]\n\n')
    }) as unknown as typeof fetch
    const a = new OpenAICompatibleAdapter({ providerType: 'ollama', baseUrl: 'http://h/v1', apiKey: 'x', includeUsage: false, fetchImpl })
    await collect(a.streamChat({ model: 'llama', messages: [] }))
    expect(reqBody?.stream_options).toBeUndefined()
  })

  it('throws ProviderError on a non-2xx response', async () => {
    const fetchImpl = (async () => streamResponse('unauthorized', 401)) as unknown as typeof fetch
    const a = new OpenAICompatibleAdapter({ providerType: 'openai', baseUrl: 'https://x/v1', apiKey: 'bad', fetchImpl })
    await expect(collect(a.streamChat({ model: 'gpt', messages: [] }))).rejects.toBeInstanceOf(ProviderError)
  })

  it('lists models from a data[] payload', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }), { status: 200 })) as unknown as typeof fetch
    const a = new OpenAICompatibleAdapter({ providerType: 'openai', baseUrl: 'https://x/v1', apiKey: 'k', fetchImpl })
    const models = await a.listModels()
    expect(models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })
})
