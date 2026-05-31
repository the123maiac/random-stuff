export interface SSEEvent {
  event?: string
  data: string
}

function parseEvent(raw: string): SSEEvent {
  let event: string | undefined
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''))
    } else if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    }
  }
  return { event, data: dataLines.join('\n') }
}

/**
 * Parses a Server-Sent Events byte stream into discrete events. Carriage
 * returns are stripped so CRLF and LF framing are handled uniformly, and
 * events split across chunk boundaries are reassembled.
 */
export async function* readSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
      let sep = buffer.indexOf('\n\n')
      while (sep !== -1) {
        const raw = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        if (raw.length > 0) yield parseEvent(raw)
        sep = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
  buffer += decoder.decode().replace(/\r/g, '')
  if (buffer.trim().length > 0) yield parseEvent(buffer)
}
