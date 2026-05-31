'use client'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import type { AuthState } from './actions'

type Action = (state: AuthState, formData: FormData) => Promise<AuthState>

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Working…' : label}
    </button>
  )
}

export function AuthForm({
  action,
  submitLabel,
  altHref,
  altLabel,
  notice,
}: {
  action: Action
  submitLabel: string
  altHref: string
  altLabel: string
  notice?: string
}) {
  const [state, formAction] = useActionState(action, undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {notice && (
        <p className="rounded-md border border-black/10 bg-black/[.03] px-3 py-2 text-sm dark:border-white/15 dark:bg-white/[.04]">
          {notice}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-foreground dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-foreground dark:border-white/20"
        />
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <SubmitButton label={submitLabel} />

      <p className="text-center text-sm text-black/60 dark:text-white/60">
        <Link href={altHref} className="underline underline-offset-4 hover:text-foreground">
          {altLabel}
        </Link>
      </p>
    </form>
  )
}
