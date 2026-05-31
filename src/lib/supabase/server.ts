import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Supabase client bound to the current request's session cookies. Runs as the
 * `authenticated` (or `anon`) role, so every query it makes is subject to RLS —
 * this is the client to use in Server Components, Server Actions, and Route
 * Handlers that act on behalf of the signed-in user.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot set cookies. Session refresh is handled
            // by the proxy, so swallowing this is safe.
          }
        },
      },
    },
  )
}
