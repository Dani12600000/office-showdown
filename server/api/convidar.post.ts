import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Não autenticado.' })

  const admin = serverSupabaseServiceRole(event)

  const { data: perfil } = await admin
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()

  if (!perfil?.admin) throw createError({ statusCode: 403, message: 'Acesso negado.' })

  const { email } = await readBody<{ email: string }>(event)
  if (!email?.trim()) throw createError({ statusCode: 400, message: 'Email obrigatório.' })

  const origin = getRequestURL(event).origin

  const { error } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: `${origin}/aceitar-convite`,
  })

  if (error) throw createError({ statusCode: 400, message: error.message })

  return { ok: true }
})
