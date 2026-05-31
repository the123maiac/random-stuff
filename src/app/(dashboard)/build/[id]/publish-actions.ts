'use server'
import { promises as dns } from 'node:dns'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateSlug } from '@/lib/publish/slug'
import { normalizeHostname, verificationRecordName } from '@/lib/publish/domains'

export type PublishActionState = { error?: string; ok?: string } | undefined

function appHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Snapshots the project's current HTML into a public site, minting a slug on
 *  first publish and overwriting the snapshot on subsequent publishes. */
export async function publishProject(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = z.uuid().safeParse(formData.get('projectId'))
  if (!id.success) return
  const projectId = id.data

  const admin = createSupabaseAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('id, current_html')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!project || !project.current_html) return

  const { data: existing } = await admin
    .from('published_sites')
    .select('id')
    .eq('project_id', project.id)
    .maybeSingle()

  if (existing) {
    await admin
      .from('published_sites')
      .update({ html: project.current_html })
      .eq('id', existing.id)
  } else {
    // Insert with a fresh slug; retry only on a slug collision (unique violation).
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await admin.from('published_sites').insert({
        project_id: project.id,
        user_id: user.id,
        slug: generateSlug(),
        html: project.current_html,
      })
      if (!error || error.code !== '23505') break
    }
  }

  revalidatePath(`/build/${projectId}`)
}

export async function unpublishProject(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = z.uuid().safeParse(formData.get('projectId'))
  if (!id.success) return

  const admin = createSupabaseAdminClient()
  // Cascade removes any attached custom_domains rows.
  await admin.from('published_sites').delete().eq('project_id', id.data).eq('user_id', user.id)

  revalidatePath(`/build/${id.data}`)
}

const addDomainSchema = z.object({
  projectId: z.uuid(),
  hostname: z.string().trim().min(1),
})

export async function addCustomDomain(
  _prev: PublishActionState,
  formData: FormData,
): Promise<PublishActionState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Your session expired. Please sign in again.' }

  const parsed = addDomainSchema.safeParse({
    projectId: formData.get('projectId'),
    hostname: formData.get('hostname'),
  })
  if (!parsed.success) return { error: 'Enter the domain you want to use.' }

  const hostname = normalizeHostname(parsed.data.hostname)
  if (!hostname) return { error: 'That does not look like a valid domain name.' }
  if (hostname === appHostname()) return { error: 'That is this app’s own domain.' }

  const admin = createSupabaseAdminClient()
  const { data: site } = await admin
    .from('published_sites')
    .select('id')
    .eq('project_id', parsed.data.projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!site) return { error: 'Publish the app before attaching a domain.' }

  const token = randomBytes(16).toString('hex')
  const { error } = await admin.from('custom_domains').insert({
    site_id: site.id,
    user_id: user.id,
    hostname,
    verification_token: token,
  })
  if (error) {
    if (error.code === '23505') return { error: 'That domain is already attached to a site.' }
    return { error: 'Could not add that domain. Please try again.' }
  }

  revalidatePath(`/build/${parsed.data.projectId}`)
  return { ok: `Added ${hostname}. Add the DNS records below, then verify.` }
}

/** Confirms ownership by looking up the TXT challenge record over DNS. */
export async function verifyCustomDomain(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const domainId = z.uuid().safeParse(formData.get('domainId'))
  const projectId = z.uuid().safeParse(formData.get('projectId'))
  if (!domainId.success || !projectId.success) return

  const admin = createSupabaseAdminClient()
  const { data: domain } = await admin
    .from('custom_domains')
    .select('id, hostname, verification_token')
    .eq('id', domainId.data)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!domain) return

  let verified = false
  try {
    const records = await dns.resolveTxt(verificationRecordName(domain.hostname))
    const values = records.map((chunks) => chunks.join('').trim())
    verified = values.includes(domain.verification_token)
  } catch {
    verified = false
  }

  if (verified) {
    await admin
      .from('custom_domains')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', domain.id)
  }

  revalidatePath(`/build/${projectId.data}`)
}

export async function removeCustomDomain(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const domainId = z.uuid().safeParse(formData.get('domainId'))
  const projectId = z.uuid().safeParse(formData.get('projectId'))
  if (!domainId.success || !projectId.success) return

  const admin = createSupabaseAdminClient()
  await admin.from('custom_domains').delete().eq('id', domainId.data).eq('user_id', user.id)

  revalidatePath(`/build/${projectId.data}`)
}
