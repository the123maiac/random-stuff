import { AuthForm } from '@/app/auth/auth-form'
import { signUp } from '@/app/auth/actions'

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Create account</h1>
        <p className="mb-6 text-sm text-black/60 dark:text-white/60">
          Bring your own AI keys and start shipping.
        </p>
        <AuthForm
          action={signUp}
          submitLabel="Sign up"
          altHref="/login"
          altLabel="Already have an account? Sign in"
        />
      </div>
    </main>
  )
}
