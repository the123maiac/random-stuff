import type { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serveSiteHtml, notFoundSite } from '@/lib/publish/serve'

export const runtime = 'nodejs'

/**
 * Serves a published site addressed by a custom domain. The proxy rewrites any
 * request whose Host is not the app's own host to this handler, preserving the
 * original Host header; we resolve it to a *verified* custom domain and serve
 * the linked snapshot. Unverified or unknown hosts 404.
 */
export async function GET(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (!host) return notFoundSite()

  const admin = createSupabaseAdminClient()
  const { data: domain } = await admin
    .from('custom_domains')
    .select('site_id, verified_at')
    .eq('hostname', host)
    .maybeSingle()

  if (!domain || !domain.verified_at) return notFoundSite()

  const { data: site } = await admin
    .from('published_sites')
    .select('html')
    .eq('id', domain.site_id)
    .maybeSingle()

  if (!site) return notFoundSite()
  return serveSiteHtml(site.html)
}
