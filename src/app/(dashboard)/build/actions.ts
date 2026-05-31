'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function createProject(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id })
    .select('id')
    .single()

  if (error || !data) redirect('/build')
  redirect(`/build/${data.id}`)
}

export async function deleteProject(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return

  const supabase = await createSupabaseServerClient()
  // RLS restricts the delete to the owner's row.
  await supabase.from('projects').delete().eq('id', id.data)

  revalidatePath('/build')
}
