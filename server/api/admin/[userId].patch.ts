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

  const userId = getRouterParam(event, 'userId')
  if (userId === user.id) throw createError({ statusCode: 400, message: 'Não podes alterar o teu próprio status de admin.' })

  const { novoAdmin } = await readBody<{ novoAdmin: boolean }>(event)
  if (typeof novoAdmin !== 'boolean') throw createError({ statusCode: 400, message: 'Valor inválido.' })

  const { error } = await serviceClient
    .from('profiles')
    .update({ admin: novoAdmin })
    .eq('id', userId)

  if (error) throw createError({ statusCode: 400, message: error.message })

  return { ok: true }
})
