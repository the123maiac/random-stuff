import { requireUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PROVIDERS } from '@/lib/providers/registry'
import { ConnectionForm } from './connection-form'
import { deleteConnection } from './actions'

export default async function ConnectionsPage() {
  await requireUser()
  const supabase = await createSupabaseServerClient()

  // encrypted_key/key_version are revoked from the browser role, so they are
  // deliberately absent from this projection.
  const { data: connections } = await supabase
    .from('provider_connections')
    .select('id, provider_type, label, base_url, created_at, last_used_at')
    .order('created_at', { ascending: false })

  const providers = Object.values(PROVIDERS)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Connections</h1>
      <p className="mb-8 text-sm text-black/60 dark:text-white/60">
        Your API keys are encrypted before they touch the database and are only ever decrypted
        server-side to make a call. They are never sent back to your browser.
      </p>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-3">
          {connections && connections.length > 0 ? (
            connections.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.label}</p>
                  <p className="text-xs text-black/55 dark:text-white/55">
                    {PROVIDERS[c.provider_type]?.label ?? c.provider_type}
                    {c.base_url ? ` · ${c.base_url}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                    {c.last_used_at
                      ? `Last used ${new Date(c.last_used_at).toLocaleDateString()}`
                      : 'Never used'}
                  </p>
                </div>
                <form action={deleteConnection}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/20 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
              No connections yet. Add your first provider key to start building.
            </div>
          )}
        </section>

        <ConnectionForm providers={providers} />
      </div>
    </div>
  )
}
