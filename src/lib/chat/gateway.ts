import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getKeyring } from '@/lib/crypto/server-keyring'
import { openSecret } from '@/lib/crypto/keyring'
import { createAdapter } from '@/lib/providers/registry'
import type { ProviderAdapter, ProviderType } from '@/lib/providers/types'

export const RATE_LIMIT_WINDOW_SECONDS = 60
export const RATE_LIMIT_MAX = 60

/** Carries an HTTP status so route handlers can map failures to responses. */
export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export interface GatewayConnection {
  id: string
  providerType: ProviderType
}

/** Atomically bumps the user's request counter; throws 429 when over budget. */
export async function enforceRateLimit(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { data: allowed, error } = await admin.rpc('bump_rate_limit', {
    p_user_id: userId,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_limit: RATE_LIMIT_MAX,
  })
  if (error) throw new GatewayError(503, 'Rate limiter unavailable')
  if (!allowed) {
    throw new GatewayError(429, 'Rate limit exceeded. Please wait a moment and try again.')
  }
}

/**
 * Loads a connection the user owns, decrypts its key server-side, and builds
 * the provider adapter. Scopes by user_id because the admin client bypasses RLS.
 */
export async function loadAdapter(
  userId: string,
  connectionId: string,
): Promise<{ adapter: ProviderAdapter; connection: GatewayConnection }> {
  const admin = createSupabaseAdminClient()
  const { data: conn, error } = await admin
    .from('provider_connections')
    .select('id, provider_type, encrypted_key, base_url')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new GatewayError(500, 'Failed to load connection')
  if (!conn) throw new GatewayError(404, 'Connection not found')

  let apiKey: string
  try {
    apiKey = openSecret(conn.encrypted_key, getKeyring())
  } catch {
    throw new GatewayError(500, 'Failed to decrypt provider key')
  }

  const adapter = createAdapter({
    providerType: conn.provider_type,
    apiKey,
    baseUrl: conn.base_url,
  })
  return { adapter, connection: { id: conn.id, providerType: conn.provider_type } }
}

export interface UsageInput {
  userId: string
  connectionId: string
  providerType: ProviderType
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** Records a usage event and refreshes last_used_at. Best-effort: never throws. */
export async function logUsage(input: UsageInput): Promise<void> {
  const admin = createSupabaseAdminClient()
  try {
    await admin.from('usage_events').insert({
      user_id: input.userId,
      connection_id: input.connectionId,
      provider_type: input.providerType,
      model: input.model,
      prompt_tokens: input.promptTokens,
      completion_tokens: input.completionTokens,
      total_tokens: input.totalTokens,
    })
    await admin
      .from('provider_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', input.connectionId)
  } catch {
    // usage logging must not break the user's request
  }
}
