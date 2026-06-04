import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Não autenticado.' })

  // Verifica admin usando o cliente autenticado do utilizador (cookie de sessão → RLS)
  const client = await serverSupabaseClient(event)
  const { data: perfil, error: perfilError } = await client
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil?.admin) throw createError({ statusCode: 403, message: 'Acesso negado.' })

  const userId = getRouterParam(event, 'userId')
  if (userId === user.id) throw createError({ statusCode: 400, message: 'Não podes alterar o teu próprio status de admin.' })

  const { novoAdmin } = await readBody<{ novoAdmin: boolean }>(event)
  if (typeof novoAdmin !== 'boolean') throw createError({ statusCode: 400, message: 'Valor inválido.' })

  // Usa service role para atualizar outro utilizador
  const serviceClient = serverSupabaseServiceRole(event)
  const { error } = await serviceClient
    .from('profiles')
    .update({ admin: novoAdmin })
    .eq('id', userId)

  if (error) throw createError({ statusCode: 400, message: error.message })

  return { ok: true }
})
