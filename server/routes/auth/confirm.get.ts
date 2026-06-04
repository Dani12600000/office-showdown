import type { EmailOtpType } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as Record<string, string>
  const next = query.next ?? '/'

  const client = await serverSupabaseClient(event)

  // Fluxo token_hash (SSR) — query params são visíveis ao servidor
  const token_hash = query.token_hash
  const type = query.type as EmailOtpType | undefined
  if (token_hash && type) {
    const { error } = await client.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return sendRedirect(event, next)
    }
  }

  // Fluxo PKCE (?code=)
  const code = query.code
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (!error) {
      return sendRedirect(event, next)
    }
  }

  return sendRedirect(event, '/login?erro=link-invalido')
})
