import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { loadAdapter, GatewayError } from '@/lib/chat/gateway'
import { ProviderError } from '@/lib/providers/types'

export const runtime = 'nodejs'

/** Lists the models available for one of the caller's connections. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connectionId = z.uuid().safeParse(request.nextUrl.searchParams.get('connectionId'))
  if (!connectionId.success) {
    return NextResponse.json({ error: 'Invalid connection id' }, { status: 400 })
  }

  let adapter
  try {
    ;({ adapter } = await loadAdapter(user.id, connectionId.data))
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Gateway error' }, { status: 500 })
  }

  try {
    const models = await adapter.listModels()
    return NextResponse.json({ models })
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 502
    const message = err instanceof ProviderError ? err.message : 'Could not reach provider'
    return NextResponse.json({ error: message }, { status })
  }
}
