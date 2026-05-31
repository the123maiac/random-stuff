'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getKeyring } from '@/lib/crypto/server-keyring'
import { sealSecret } from '@/lib/crypto/keyring'
import { PROVIDERS, resolveBaseUrl } from '@/lib/providers/registry'

const providerTypeEnum = z.enum([
  'openai',
  'groq',
  'nvidia',
  'openrouter',
  'ollama',
  'custom_openai',
  'anthropic',
])

const createSchema = z.object({
  providerType: providerTypeEnum,
  label: z.string().trim().min(1, 'Name is required.').max(60),
  apiKey: z.string().trim().min(1, 'API key is required.'),
  baseUrl: z.string().trim().optional(),
})

export type ConnectionFormState = { error?: string; ok?: boolean } | undefined

export async function createConnection(
  _prev: ConnectionFormState,
  formData: FormData,
): Promise<ConnectionFormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Your session expired. Please sign in again.' }

  const parsed = createSchema.safeParse({
    providerType: formData.get('providerType'),
    label: formData.get('label'),
    apiKey: formData.get('apiKey'),
    baseUrl: formData.get('baseUrl') ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const input = parsed.data
  const meta = PROVIDERS[input.providerType]

  // Only providers with a user endpoint persist a base_url; the rest resolve
  // their fixed default at call time.
  let baseUrl: string | null = null
  if (meta.baseUrlEditable) {
    try {
      baseUrl = resolveBaseUrl(input.providerType, input.baseUrl || undefined)
      new URL(baseUrl)
    } catch {
      return { error: `${meta.label} needs a valid base URL.` }
    }
  }

  const { encryptedKey, keyVersion } = sealSecret(input.apiKey, getKeyring())

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('provider_connections').insert({
    user_id: user.id,
    provider_type: input.providerType,
    label: input.label,
    encrypted_key: encryptedKey,
    key_version: keyVersion,
    base_url: baseUrl,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `You already have a ${meta.label} connection named “${input.label}”.` }
    }
    return { error: 'Could not save the connection. Please try again.' }
  }

  revalidatePath('/connections')
  return { ok: true }
}

export async function deleteConnection(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return

  const admin = createSupabaseAdminClient()
  // Scope by user_id: admin bypasses RLS, so this guards against deleting
  // someone else's row by guessing its id.
  await admin.from('provider_connections').delete().eq('id', id.data).eq('user_id', user.id)

  revalidatePath('/connections')
}
