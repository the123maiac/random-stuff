import { publishProject, unpublishProject, verifyCustomDomain, removeCustomDomain } from './publish-actions'
import { AddDomainForm } from './add-domain-form'
import { verificationRecordName } from '@/lib/publish/domains'

export interface PublishSite {
  slug: string
  publishedAt: string
}

export interface PublishDomain {
  id: string
  hostname: string
  verified: boolean
  token: string
}

const ghostButton =
  'rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]'

function Dns({ name, type, value }: { name: string; type: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
      <span className="text-black/45 dark:text-white/45">Type</span>
      <span className="break-all">{type}</span>
      <span className="text-black/45 dark:text-white/45">Name</span>
      <span className="break-all">{name}</span>
      <span className="text-black/45 dark:text-white/45">Value</span>
      <span className="break-all">{value}</span>
    </div>
  )
}

export function PublishPanel({
  projectId,
  canPublish,
  site,
  domains,
  publicBaseUrl,
  appHost,
}: {
  projectId: string
  canPublish: boolean
  site: PublishSite | null
  domains: PublishDomain[]
  publicBaseUrl: string | null
  appHost: string | null
}) {
  const publicUrl = site ? `${publicBaseUrl ?? ''}/s/${site.slug}` : null
  const cnameTarget = appHost ?? 'your app’s hostname'

  return (
    <section className="mt-10 border-t border-black/10 pt-8 dark:border-white/15">
      <h2 className="text-lg font-semibold">Publish &amp; deploy</h2>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Snapshot the current version to a public, HTTPS URL — then point your own domain at it.
      </p>

      {!site ? (
        <div className="mt-5">
          {canPublish ? (
            <form action={publishProject}>
              <input type="hidden" name="projectId" value={projectId} />
              <button
                type="submit"
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Publish app
              </button>
            </form>
          ) : (
            <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
              Generate your app first, then publish it.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          {/* Live URL + lifecycle controls */}
          <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-black/45 dark:text-white/45">Live at</p>
                {publicBaseUrl ? (
                  <a
                    href={publicUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium underline underline-offset-4"
                  >
                    {publicUrl}
                  </a>
                ) : (
                  <p className="break-all font-mono text-sm">{publicUrl}</p>
                )}
              </div>
              <div className="flex gap-2">
                <form action={publishProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <button type="submit" className={ghostButton}>
                    Update published version
                  </button>
                </form>
                <form action={unpublishProject}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <button
                    type="submit"
                    className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/20 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Unpublish
                  </button>
                </form>
              </div>
            </div>
            {!publicBaseUrl && (
              <p className="text-xs text-black/45 dark:text-white/45">
                Set <code>NEXT_PUBLIC_APP_URL</code> to show the full public link.
              </p>
            )}
          </div>

          {/* Custom domains */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Custom domains</h3>

            {domains.length > 0 && (
              <ul className="flex flex-col gap-3">
                {domains.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{d.hostname}</span>
                      <div className="flex items-center gap-2">
                        {d.verified ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                            Verified
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            Pending DNS
                          </span>
                        )}
                        {!d.verified && (
                          <form action={verifyCustomDomain}>
                            <input type="hidden" name="domainId" value={d.id} />
                            <input type="hidden" name="projectId" value={projectId} />
                            <button type="submit" className={ghostButton}>
                              Verify
                            </button>
                          </form>
                        )}
                        <form action={removeCustomDomain}>
                          <input type="hidden" name="domainId" value={d.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <button
                            type="submit"
                            className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/20 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    </div>

                    {!d.verified && (
                      <div className="flex flex-col gap-3 rounded-md bg-black/[.03] p-3 dark:bg-white/[.04]">
                        <div>
                          <p className="mb-1 text-xs font-medium text-black/55 dark:text-white/55">
                            1. Add this TXT record to prove ownership, then click Verify:
                          </p>
                          <Dns
                            type="TXT"
                            name={verificationRecordName(d.hostname)}
                            value={d.token}
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-black/55 dark:text-white/55">
                            2. Point the domain at the app:
                          </p>
                          <Dns type="CNAME" name={d.hostname} value={cnameTarget} />
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <AddDomainForm projectId={projectId} />

            <p className="text-xs text-black/45 dark:text-white/45">
              Once a domain is verified and its DNS points at the app, the hosting platform issues
              an HTTPS certificate automatically — your app then serves securely on your domain.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
