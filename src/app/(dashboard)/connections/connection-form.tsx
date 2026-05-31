'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ProviderMeta } from '@/lib/providers/registry'
import { createConnection, type ConnectionFormState } from './actions'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Add connection'}
    </button>
  )
}

const inputClass =
  'rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20'

export function ConnectionForm({ providers }: { providers: ProviderMeta[] }) {
  const [state, formAction] = useActionState<ConnectionFormState, FormData>(createConnection, undefined)
  const [selectedType, setSelectedType] = useState(providers[0]?.type)
  const formRef = useRef<HTMLFormElement>(null)

  const meta = providers.find((p) => p.type === selectedType) ?? providers[0]

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      setSelectedType(providers[0]?.type)
    }
  }, [state?.ok, providers])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-black/10 p-5 dark:border-white/15"
    >
      <h2 className="text-base font-semibold">Add a provider key</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Provider</span>
        <select
          name="providerType"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as ProviderMeta['type'])}
          className={inputClass}
        >
          {providers.map((p) => (
            <option key={p.type} value={p.type}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name</span>
        <input name="label" defaultValue={meta?.label} required maxLength={60} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">API key</span>
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          placeholder={meta?.keyHelp}
          className={inputClass}
        />
        {meta?.keyHelp && (
          <span className="text-xs text-black/50 dark:text-white/50">Get one at {meta.keyHelp}</span>
        )}
      </label>

      {meta?.baseUrlEditable && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Base URL</span>
          <input
            name="baseUrl"
            type="url"
            defaultValue={meta.defaultBaseUrl ?? ''}
            placeholder="https://your-endpoint/v1"
            className={inputClass}
          />
          <span className="text-xs text-black/50 dark:text-white/50">
            Must be reachable from our servers (a public URL, not localhost).
          </span>
        </label>
      )}

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-green-600 dark:text-green-400">Connection saved.</p>}

      <div>
        <SaveButton />
      </div>
    </form>
  )
}
