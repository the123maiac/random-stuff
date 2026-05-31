import { NextResponse, type NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { enforceRateLimit, loadAdapter, logUsage, GatewayError } from '@/lib/chat/gateway'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { BUILDER_SYSTEM_PROMPT } from '@/lib/build/system-prompt'
import { extractHtml } from '@/lib/build/extract-html'
import type { ChatStreamEvent } from '@/lib/chat/schema'
import type { ChatMessage } from '@/lib/providers/types'
import { ProviderError } from '@/lib/providers/types'

export const runtime = 'nodejs'

const bodySchema = z.object({
  connectionId: z.uuid(),
  model: z.string().min(1),
  instruction: z.string().trim().min(1).max(8000),
})

function sse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/build/[id]/generate'>) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    const detail =
      err instanceof ZodError ? err.issues.map((i) => i.message).join('; ') : 'Invalid request body'
    return NextResponse.json({ error: detail }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, title, current_html')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (projectError) return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

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

  // Record the user's instruction immediately so the thread is durable even if
  // generation fails midway.
  await admin
    .from('project_messages')
    .insert({ project_id: project.id, user_id: user.id, role: 'user', content: body.instruction })

  // The model only needs the current document plus the new instruction to make
  // an edit — this keeps token usage bounded regardless of thread length.
  const messages: ChatMessage[] = [
    { role: 'system', content: BUILDER_SYSTEM_PROMPT },
    ...(project.current_html
      ? [{ role: 'assistant' as const, content: project.current_html }]
      : []),
    { role: 'user', content: body.instruction },
  ]

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

      let full = ''
      let prompt = 0
      let completion = 0
      let total = 0

      try {
        for await (const chunk of adapter.streamChat({
          model: body.model,
          messages,
          signal: request.signal,
        })) {
          if (chunk.delta) {
            full += chunk.delta
            send({ delta: chunk.delta })
          }
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

      const html = extractHtml(full)
      const title =
        project.title === 'Untitled app' ? body.instruction.slice(0, 60) : project.title

      try {
        await admin
          .from('projects')
          .update({
            current_html: html,
            connection_id: body.connectionId,
            model: body.model,
            title,
          })
          .eq('id', project.id)
        await admin.from('project_messages').insert({
          project_id: project.id,
          user_id: user.id,
          role: 'assistant',
          content: html,
        })
      } catch {
        // persistence failure should not break the user's stream
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
