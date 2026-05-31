'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const credsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

export type AuthState = { error: string } | undefined

function readCreds(formData: FormData) {
  return credsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = readCreds(formData)
  if (!parsed.success) return { error: 'Enter a valid email and an 8+ character password.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: error.message }

  redirect('/')
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = readCreds(formData)
  if (!parsed.success) return { error: 'Enter a valid email and an 8+ character password.' }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp(parsed.data)
  if (error) return { error: error.message }

  // When email confirmation is enabled, no session is returned yet.
  if (!data.session) {
    redirect('/login?check_email=1')
  }
  redirect('/')
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
