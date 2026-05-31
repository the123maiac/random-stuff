import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { signOut } from '@/app/auth/actions'

// Auth boundary for every dashboard route: redirects to /login when there is
// no verified session, independent of the optimistic proxy check.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold">
            Vibeship
          </Link>
          <Link href="/build" className="text-black/70 hover:text-foreground dark:text-white/70">
            Build
          </Link>
          <Link href="/connections" className="text-black/70 hover:text-foreground dark:text-white/70">
            Connections
          </Link>
          <Link href="/playground" className="text-black/70 hover:text-foreground dark:text-white/70">
            Playground
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-black/50 sm:inline dark:text-white/50">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-black/15 px-3 py-1.5 transition-colors hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
              >
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
