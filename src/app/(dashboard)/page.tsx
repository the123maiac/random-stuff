import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { count } = await supabase
    .from('provider_connections')
    .select('id', { count: 'exact', head: true })

  const connectionCount = count ?? 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Welcome to Vibeship</h1>
      <p className="mt-2 max-w-2xl text-black/60 dark:text-white/60">
        Connect your own AI provider keys, test models in the playground, then vibe-code an app and
        ship it to your domain.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/build"
          className="rounded-lg border border-black/10 p-6 transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04]"
        >
          <h2 className="text-lg font-medium">Build</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Describe an app in plain language and watch it come to life in a live preview.
          </p>
        </Link>

        <Link
          href="/connections"
          className="rounded-lg border border-black/10 p-6 transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04]"
        >
          <h2 className="text-lg font-medium">Connections</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {connectionCount === 0
              ? 'No provider keys yet — add one to get started.'
              : `${connectionCount} provider ${connectionCount === 1 ? 'key' : 'keys'} connected.`}
          </p>
        </Link>

        <Link
          href="/playground"
          className="rounded-lg border border-black/10 p-6 transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04]"
        >
          <h2 className="text-lg font-medium">Playground</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Stream a chat against any connected model and confirm your keys work.
          </p>
        </Link>
      </div>
    </div>
  )
}
