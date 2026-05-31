import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PROVIDERS } from '@/lib/providers/registry'
import { Playground, type PlaygroundConnection } from './playground'

export default async function PlaygroundPage() {
  await requireUser()
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('provider_connections')
    .select('id, provider_type, label')
    .order('created_at', { ascending: false })

  const connections: PlaygroundConnection[] = (data ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    providerLabel: PROVIDERS[c.provider_type]?.label ?? c.provider_type,
  }))

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Playground</h1>
      <p className="mb-8 text-sm text-black/60 dark:text-white/60">
        Stream a chat against any connected model to confirm a key works.
      </p>

      {connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
          You need a connection first.{' '}
          <Link href="/connections" className="underline underline-offset-4">
            Add a provider key
          </Link>
          .
        </div>
      ) : (
        <Playground connections={connections} />
      )}
    </div>
  )
}
