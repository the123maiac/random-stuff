import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PROVIDERS } from '@/lib/providers/registry'
import { publicEnv } from '@/lib/env'
import { Builder, type BuilderConnection, type BuilderMessage } from './builder'
import { PublishPanel, type PublishDomain, type PublishSite } from './publish-panel'

export default async function BuildProjectPage({ params }: PageProps<'/build/[id]'>) {
  await requireUser()
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  // RLS limits this to the owner's row, so a miss means "not yours or gone".
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, connection_id, model, current_html')
    .eq('id', id)
    .maybeSingle()

  if (!project) notFound()

  const [{ data: messageRows }, { data: connectionRows }, { data: siteRow }] = await Promise.all([
    supabase
      .from('project_messages')
      .select('id, role, content, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('provider_connections')
      .select('id, provider_type, label')
      .order('created_at', { ascending: false }),
    supabase
      .from('published_sites')
      .select('id, slug, published_at')
      .eq('project_id', project.id)
      .maybeSingle(),
  ])

  const connections: BuilderConnection[] = (connectionRows ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    providerLabel: PROVIDERS[c.provider_type]?.label ?? c.provider_type,
  }))

  const thread: BuilderMessage[] = (messageRows ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }))

  const site: PublishSite | null = siteRow
    ? { slug: siteRow.slug, publishedAt: siteRow.published_at }
    : null

  let domains: PublishDomain[] = []
  if (siteRow) {
    const { data: domainRows } = await supabase
      .from('custom_domains')
      .select('id, hostname, verified_at, verification_token')
      .eq('site_id', siteRow.id)
      .order('created_at', { ascending: true })
    domains = (domainRows ?? []).map((d) => ({
      id: d.id,
      hostname: d.hostname,
      verified: Boolean(d.verified_at),
      token: d.verification_token,
    }))
  }

  const publicBaseUrl = publicEnv.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? null
  const appHost = publicBaseUrl ? new URL(publicBaseUrl).hostname : null

  return (
    <>
      <Builder
        projectId={project.id}
        title={project.title}
        initialHtml={project.current_html ?? ''}
        initialConnectionId={project.connection_id ?? ''}
        initialModel={project.model ?? ''}
        connections={connections}
        initialThread={thread}
      />
      <div className="mx-auto w-full max-w-6xl px-4 pb-12">
        <PublishPanel
          projectId={project.id}
          canPublish={Boolean(project.current_html)}
          site={site}
          domains={domains}
          publicBaseUrl={publicBaseUrl}
          appHost={appHost}
        />
      </div>
    </>
  )
}
