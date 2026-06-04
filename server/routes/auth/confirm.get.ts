import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as Record<string, string>
  const next = query.next ?? '/'

  // PKCE flow: troca o código pela sessão (server-side, compatível com @supabase/ssr)
  const code = query.code
  if (code) {
    const client = await serverSupabaseClient(event)
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (!error) {
      return sendRedirect(event, next)
    }
  }

  // token_hash flow (email OTP / invite mais antigas)
  const token_hash = query.token_hash
  const type = query.type as 'invite' | 'signup' | 'recovery' | 'email_change' | undefined
  if (token_hash && type) {
    const client = await serverSupabaseClient(event)
    const { error } = await client.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return sendRedirect(event, next)
    }
  }

  // Sem código válido → volta ao login com erro
  return sendRedirect(event, '/login?erro=link-invalido')
})
