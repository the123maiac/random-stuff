import type { ChatStreamEvent } from './schema'

/**
 * Parses the gateway's `text/event-stream` body (lines of `data: {json}` and a
 * terminal `data: [DONE]`) into typed events. Browser-safe — no Node APIs.
 */
export async function* readChatStream(res: Response): AsyncGenerator<ChatStreamEvent> {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep = buffer.indexOf('\n\n')
    while (sep !== -1) {
      const raw = buffer.slice(0, sep).trim()
      buffer = buffer.slice(sep + 2)
      if (raw.startsWith('data:')) {
        const data = raw.slice(5).trim()
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data) as ChatStreamEvent
        } catch {
          // ignore malformed line
        }
      }
      sep = buffer.indexOf('\n\n')
    }
  }
}
