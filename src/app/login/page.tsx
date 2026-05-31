import { AuthForm } from '@/app/auth/auth-form'
import { signIn } from '@/app/auth/actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check_email?: string; error?: string }>
}) {
  const sp = await searchParams
  const notice = sp.check_email
    ? 'Account created. Check your email to confirm, then sign in.'
    : sp.error
      ? 'Sign-in failed. Please try again.'
      : undefined

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-black/60 dark:text-white/60">Welcome back to Vibeship.</p>
        <AuthForm
          action={signIn}
          submitLabel="Sign in"
          altHref="/signup"
          altLabel="Need an account? Sign up"
          notice={notice}
        />
      </div>
    </main>
  )
}
