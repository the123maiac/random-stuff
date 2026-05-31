import type { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serveSiteHtml, notFoundSite } from '@/lib/publish/serve'

// Admin client (service role) + node:crypto in the SDK chain need Node.
export const runtime = 'nodejs'

/** Serves a published site by its public slug, e.g. /s/abc123. */
export async function GET(_request: NextRequest, ctx: RouteContext<'/s/[slug]'>) {
  const { slug } = await ctx.params

  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('published_sites')
    .select('html')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return notFoundSite()
  return serveSiteHtml(data.html)
}
