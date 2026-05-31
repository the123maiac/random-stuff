'use client'
import { useRef, useState } from 'react'
import { readChatStream } from '@/lib/chat/client-stream'

export interface PlaygroundConnection {
  id: string
  label: string
  providerLabel: string
}

interface Usage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

const inputClass =
  'rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20'

export function Playground({ connections }: { connections: PlaygroundConnection[] }) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? '')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [modelsState, setModelsState] = useState<{ loading: boolean; error?: string }>({
    loading: false,
  })
  const [system, setSystem] = useState('')
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function loadModels() {
    if (!connectionId) return
    setModelsState({ loading: true })
    setModels([])
    try {
      const res = await fetch(`/api/models?connectionId=${encodeURIComponent(connectionId)}`)
      const json = await res.json()
      if (!res.ok) {
        setModelsState({ loading: false, error: json.error ?? 'Failed to load models' })
        return
      }
      const ids: string[] = (json.models ?? []).map((m: { id: string }) => m.id)
      setModels(ids)
      if (ids.length > 0 && !model) setModel(ids[0])
      setModelsState({ loading: false })
    } catch {
      setModelsState({ loading: false, error: 'Failed to load models' })
    }
  }

  async function send() {
    if (!connectionId || !model.trim() || !prompt.trim() || streaming) return
    setOutput('')
    setUsage(null)
    setError(null)
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const messages = [
      ...(system.trim() ? [{ role: 'system' as const, content: system.trim() }] : []),
      { role: 'user' as const, content: prompt.trim() },
    ]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId, model: model.trim(), messages }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? `Request failed (${res.status})`)
        return
      }

      for await (const event of readChatStream(res)) {
        if (event.delta) setOutput((prev) => prev + event.delta)
        if (event.usage) setUsage(event.usage)
        if (event.error) setError(event.error)
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError('Network error while streaming.')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Connection</span>
          <select
            value={connectionId}
            onChange={(e) => {
              setConnectionId(e.target.value)
              setModels([])
              setModelsState({ loading: false })
            }}
            className={inputClass}
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.providerLabel})
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Model</span>
          <div className="flex gap-2">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="model-options"
              placeholder="e.g. gpt-4o-mini"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={loadModels}
              disabled={modelsState.loading}
              className="whitespace-nowrap rounded-md border border-black/15 px-3 py-2 text-sm transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[.06]"
            >
              {modelsState.loading ? 'Loading…' : 'Load models'}
            </button>
          </div>
          <datalist id="model-options">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {modelsState.error && (
            <span className="text-xs text-red-600 dark:text-red-400">{modelsState.error}</span>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">System prompt (optional)</span>
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder="Say something…"
            className={inputClass}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={send}
            disabled={streaming || !model.trim() || !prompt.trim()}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {streaming ? 'Streaming…' : 'Send'}
          </button>
          {streaming && (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-black/15 px-4 py-2 text-sm transition-colors hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Output</span>
        <div className="min-h-64 flex-1 whitespace-pre-wrap rounded-md border border-black/10 bg-black/[.02] p-4 text-sm dark:border-white/15 dark:bg-white/[.03]">
          {output || <span className="text-black/40 dark:text-white/40">Response will stream here.</span>}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {usage && (
          <p className="text-xs text-black/50 dark:text-white/50">
            Tokens — prompt: {usage.promptTokens ?? '?'}, completion: {usage.completionTokens ?? '?'}
            , total: {usage.totalTokens ?? '?'}
          </p>
        )}
      </div>
    </div>
  )
}
