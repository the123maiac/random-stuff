'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { readChatStream } from '@/lib/chat/client-stream'
import { extractHtml } from '@/lib/build/extract-html'

export interface BuilderConnection {
  id: string
  label: string
  providerLabel: string
}

export interface BuilderMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const inputClass =
  'rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20'

// Best-effort render of an in-progress stream: peel a leading ```html fence and
// any trailing fence so the partial document parses in the iframe as it grows.
function previewFromPartial(text: string): string {
  let s = text.replace(/^\s*```[a-zA-Z]*\s*\n/, '')
  s = s.replace(/```\s*$/, '')
  return s
}

export function Builder({
  projectId,
  title,
  initialHtml,
  initialConnectionId,
  initialModel,
  connections,
  initialThread,
}: {
  projectId: string
  title: string
  initialHtml: string
  initialConnectionId: string
  initialModel: string
  connections: BuilderConnection[]
  initialThread: BuilderMessage[]
}) {
  const [docTitle, setDocTitle] = useState(title)
  const [connectionId, setConnectionId] = useState(
    initialConnectionId || connections[0]?.id || '',
  )
  const [model, setModel] = useState(initialModel)
  const [models, setModels] = useState<string[]>([])
  const [modelsState, setModelsState] = useState<{ loading: boolean; error?: string }>({
    loading: false,
  })
  const [instruction, setInstruction] = useState('')
  const [html, setHtml] = useState(initialHtml)
  const [thread, setThread] = useState<BuilderMessage[]>(initialThread)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastPreviewRef = useRef(0)
  const router = useRouter()

  const hasConnections = connections.length > 0

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

  async function generate() {
    const text = instruction.trim()
    if (!connectionId || !model.trim() || !text || streaming) return

    setError(null)
    setStreaming(true)
    setThread((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: text }])
    setInstruction('')

    const controller = new AbortController()
    abortRef.current = controller
    let full = ''

    try {
      const res = await fetch(`/api/build/${projectId}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId, model: model.trim(), instruction: text }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? `Request failed (${res.status})`)
        return
      }

      for await (const event of readChatStream(res)) {
        if (event.delta) {
          full += event.delta
          const now = Date.now()
          if (now - lastPreviewRef.current > 500) {
            lastPreviewRef.current = now
            setHtml(previewFromPartial(full))
          }
        }
        if (event.error) setError(event.error)
      }

      const finalHtml = extractHtml(full)
      setHtml(finalHtml)
      setThread((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: finalHtml },
      ])
      if (docTitle === 'Untitled app') setDocTitle(text.slice(0, 60))
      // Re-fetch server components (publish panel sees the new HTML, enabling
      // "Publish") without disturbing this client component's state.
      router.refresh()
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError('Network error while generating.')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  // A fresh object URL is minted on demand for "open"/"download" so the iframe's
  // sandboxed document is never granted an addressable origin.
  const makeBlobUrl = useCallback(() => {
    const blob = new Blob([html], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [html])

  function openInNewTab() {
    if (!html) return
    const url = makeBlobUrl()
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  function download() {
    if (!html) return
    const url = makeBlobUrl()
    const a = document.createElement('a')
    a.href = url
    a.download = `${docTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'app'}.html`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/build"
          className="text-sm text-black/55 hover:text-foreground dark:text-white/55"
        >
          ← Projects
        </Link>
        <h1 className="truncate text-lg font-semibold">{docTitle}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls + thread */}
        <div className="flex flex-col gap-4">
          {!hasConnections ? (
            <div className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
              You need a connection first.{' '}
              <Link href="/connections" className="underline underline-offset-4">
                Add a provider key
              </Link>
              .
            </div>
          ) : (
            <>
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
                    list="builder-model-options"
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
                <datalist id="builder-model-options">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                {modelsState.error && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {modelsState.error}
                  </span>
                )}
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {html ? 'Describe a change' : 'Describe the app'}
                </span>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate()
                  }}
                  rows={5}
                  placeholder={
                    html
                      ? 'e.g. add a dark mode toggle in the header'
                      : 'e.g. a pomodoro timer with start/pause and a task list'
                  }
                  className={inputClass}
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generate}
                  disabled={streaming || !model.trim() || !instruction.trim()}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {streaming ? 'Generating…' : html ? 'Update app' : 'Generate app'}
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

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}

          {thread.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/15">
              <span className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
                History
              </span>
              {thread.map((m) =>
                m.role === 'user' ? (
                  <div
                    key={m.id}
                    className="rounded-md bg-black/[.04] px-3 py-2 text-sm dark:bg-white/[.06]"
                  >
                    {m.content}
                  </div>
                ) : (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setHtml(m.content)}
                    title="Restore this version into the preview"
                    className="self-start rounded-full border border-black/15 px-3 py-1 text-xs text-black/60 transition-colors hover:bg-black/[.04] dark:border-white/20 dark:text-white/60 dark:hover:bg-white/[.06]"
                  >
                    ✓ Generated update
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Preview</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openInNewTab}
                disabled={!html}
                className="rounded-md border border-black/15 px-3 py-1.5 text-xs transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/[.06]"
              >
                Open
              </button>
              <button
                type="button"
                onClick={download}
                disabled={!html}
                className="rounded-md border border-black/15 px-3 py-1.5 text-xs transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/[.06]"
              >
                Download
              </button>
            </div>
          </div>
          <div className="relative h-[70vh] overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/15">
            {html ? (
              <iframe
                title="App preview"
                srcDoc={html}
                // No allow-same-origin: the generated document cannot touch the
                // host page, its cookies, or storage.
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-black/40 dark:text-white/40">
                {streaming ? 'Generating…' : 'Your app will appear here once you generate it.'}
              </div>
            )}
            {streaming && html && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background">
                Generating…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
