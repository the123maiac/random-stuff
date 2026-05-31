import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createProject, deleteProject } from './actions'

export default async function BuildPage() {
  await requireUser()
  const supabase = await createSupabaseServerClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Build</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Describe an app in plain language and watch it come to life.
          </p>
        </div>
        <form action={createProject}>
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            New project
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {projects && projects.length > 0 ? (
          projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
            >
              <Link href={`/build/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-xs text-black/45 dark:text-white/45">
                  Updated {new Date(p.updated_at).toLocaleString()}
                </p>
              </Link>
              <form action={deleteProject}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/20 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              </form>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
            No projects yet. Create one to start building.
          </div>
        )}
      </div>
    </div>
  )
}
