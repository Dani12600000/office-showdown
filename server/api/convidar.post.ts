import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const rawUser = await serverSupabaseUser(event)
  if (!rawUser) throw createError({ statusCode: 401, message: 'Não autenticado.' })

  // Supabase pode devolver o payload JWT (sub) ou o objeto User (id)
  const userId = (rawUser as any).id ?? (rawUser as any).sub
  if (!userId) throw createError({ statusCode: 401, message: 'Sessão inválida.' })

  const serviceClient = serverSupabaseServiceRole(event)

  const { data: perfil, error: perfilError } = await serviceClient
    .from('profiles')
    .select('admin')
    .eq('id', userId)
    .single()

  if (perfilError) throw createError({ statusCode: 500, message: `Erro ao verificar perfil: ${perfilError.message}` })
  if (!perfil?.admin) throw createError({ statusCode: 403, message: 'Acesso negado: não és admin.' })

  const { email } = await readBody<{ email: string }>(event)
  if (!email?.trim()) throw createError({ statusCode: 400, message: 'Email obrigatório.' })

  const origin = getRequestURL(event).origin

  const { error } = await serviceClient.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: `${origin}/auth/confirm?next=/aceitar-convite`,
  })

  if (error) throw createError({ statusCode: 400, message: error.message })

  return { ok: true }
})
