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

  const targetId = getRouterParam(event, 'userId')
  if (targetId === userId) throw createError({ statusCode: 400, message: 'Não podes alterar o teu próprio status de admin.' })

  const { novoAdmin } = await readBody<{ novoAdmin: boolean }>(event)
  if (typeof novoAdmin !== 'boolean') throw createError({ statusCode: 400, message: 'Valor inválido.' })

  const { error } = await serviceClient
    .from('profiles')
    .update({ admin: novoAdmin })
    .eq('id', targetId)

  if (error) throw createError({ statusCode: 400, message: error.message })

  return { ok: true }
})
