import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Não autenticado.' })

  const serviceClient = serverSupabaseServiceRole(event)

  const { data: perfil, error: perfilError } = await serviceClient
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()

  if (perfilError) throw createError({ statusCode: 500, message: `Erro ao verificar perfil: ${perfilError.message}` })
  if (!perfil?.admin) throw createError({ statusCode: 403, message: 'Acesso negado: não és admin.' })

  const { email } = await readBody<{ email: string }>(event)
  if (!email?.trim()) throw createError({ statusCode: 400, message: 'Email obrigatório.' })

  const origin = getRequestURL(event).origin

  const { error } = await serviceClient.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: `${origin}/aceitar-convite`,
  })

  if (error) throw createError({ statusCode: 400, message: error.message })

  return { ok: true }
})
