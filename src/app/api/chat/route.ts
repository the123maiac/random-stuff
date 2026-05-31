import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { chatRequestSchema, type ChatStreamEvent } from '@/lib/chat/schema'
import { getCurrentUser } from '@/lib/auth'
import { enforceRateLimit, loadAdapter, logUsage, GatewayError } from '@/lib/chat/gateway'
import { ProviderError } from '@/lib/providers/types'

// node:crypto (key decryption) needs the Node runtime.
export const runtime = 'nodejs'

function sse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = chatRequestSchema.parse(await request.json())
  } catch (err) {
    const detail =
      err instanceof ZodError ? err.issues.map((i) => i.message).join('; ') : 'Invalid request body'
    return NextResponse.json({ error: detail }, { status: 400 })
  }

  let adapter, connection
  try {
    await enforceRateLimit(user.id)
    ;({ adapter, connection } = await loadAdapter(user.id, body.connectionId))
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Gateway error' }, { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (e: ChatStreamEvent) => {
        if (!closed) controller.enqueue(encoder.encode(sse(e)))
      }
      const finish = () => {
        if (closed) return
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        closed = true
      }

      let prompt = 0
      let completion = 0
      let total = 0

      try {
        for await (const chunk of adapter.streamChat({
          model: body.model,
          messages: body.messages,
          temperature: body.temperature,
          maxTokens: body.maxTokens,
          signal: request.signal,
        })) {
          if (chunk.delta) send({ delta: chunk.delta })
          if (chunk.usage) {
            prompt = chunk.usage.promptTokens ?? prompt
            completion = chunk.usage.completionTokens ?? completion
            total = chunk.usage.totalTokens ?? total
            send({ usage: chunk.usage })
          }
        }
      } catch (err) {
        if (request.signal.aborted) {
          if (!closed) {
            controller.close()
            closed = true
          }
          return
        }
        const message = err instanceof ProviderError ? err.message : 'Upstream provider error'
        send({ error: message })
        finish()
        return
      }

      await logUsage({
        userId: user.id,
        connectionId: connection.id,
        providerType: connection.providerType,
        model: body.model,
        promptTokens: prompt,
        completionTokens: completion,
        totalTokens: total || prompt + completion,
      })

      finish()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
