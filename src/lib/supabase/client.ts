'use client'
import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Browser Supabase client. Runs as the `authenticated` role and is bound by
 * RLS, so it can only ever read the signed-in user's own rows — and never the
 * encrypted_key column, which is revoked from the browser role at the DB level.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
