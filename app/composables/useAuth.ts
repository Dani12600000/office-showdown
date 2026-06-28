import type { Utilizador } from '~/types/torneio'
import type { Database } from '~/types/database.types'

// Traduz mensagens de erro do Supabase (em inglês) para PT. Faz match por
// substring (case-insensitive); se não houver tradução, devolve o original.
const TRADUCOES_ERRO: [RegExp, string][] = [
  [/invalid login credentials/i,                 'Credenciais inválidas. Verifica o username e a password.'],
  [/email not confirmed/i,                       'Tens de confirmar o email antes de entrar. Verifica a tua caixa de correio.'],
  [/user already registered/i,                   'Já existe uma conta com este email.'],
  [/email address .* is invalid/i,               'O email é inválido.'],
  [/invalid email/i,                             'O email é inválido.'],
  [/password should be at least (\d+)/i,         'A password tem de ter pelo menos $1 caracteres.'],
  [/(weak|insufficient).*password|password.*(weak|insufficient)/i, 'A password é demasiado fraca.'],
  [/for security purposes.*(\d+) seconds/i,      'Por segurança, espera $1 segundos antes de tentar de novo.'],
  [/email rate limit exceeded|over_email_send_rate_limit/i, 'Demasiados emails enviados. Tenta novamente mais tarde.'],
  [/new password should be different/i,          'A nova password tem de ser diferente da atual.'],
  [/token has expired or is invalid/i,           'O link expirou ou é inválido. Pede um novo.'],
  [/same.*email|email address.*same/i,           'O novo email é igual ao atual.'],
  [/network|failed to fetch/i,                   'Erro de ligação. Verifica a tua internet e tenta de novo.'],
]
const traduzErro = (msg: string): string => {
  for (const [re, pt] of TRADUCOES_ERRO) {
    if (re.test(msg)) return msg.replace(re, pt)
  }
  return msg
}

export const useAuth = () => {
  const supabase = useSupabaseClient<Database>()
  const supabaseUser = useSupabaseUser()

  // Estado global — preenchido pelo plugin auth.client.ts antes de qualquer página renderizar
  const perfil = useState<Utilizador | null>('perfil_atual', () => null)

  const carregarPerfil = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    perfil.value = (data as Utilizador) ?? null
  }

  const login = async (username: string, password: string): Promise<void> => {
    const { data: email, error: rpcError } = await supabase
      .rpc('get_email_by_username', { p_username: username.trim().toLowerCase() })

    if (rpcError) throw new Error(`Erro ao procurar utilizador: ${rpcError.message}`)
    if (!email) throw new Error('Utilizador não encontrado.')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email as string,
      password,
    })

    if (authError) throw new Error(traduzErro(authError.message))

    // Carrega o perfil imediatamente após login (antes do navigateTo)
    if (authData.user) {
      await carregarPerfil(authData.user.id)
    }
  }

  // Verifica se um username está livre (RPC security definer → funciona p/ anónimos).
  // Devolve true se estiver disponível.
  const usernameDisponivel = async (username: string): Promise<boolean> => {
    const u = username.trim().toLowerCase()
    if (!u) return false
    const { data, error } = await (supabase as any).rpc('username_disponivel', { p_username: u })
    if (error) throw new Error(traduzErro(error.message))
    return data === true
  }

  const signup = async (username: string, name: string, email: string, password: string): Promise<{ confirmacaoPendente: boolean }> => {
    const usernameClean = username.trim().toLowerCase()

    // Verificação amigável (a BD também garante via `username unique`).
    if (!(await usernameDisponivel(usernameClean))) {
      throw new Error('Este username já está a ser utilizado.')
    }

    const { data: authData, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { username: usernameClean, name, admin: false },
        redirectTo: `${window.location.origin}/`,
      },
    })

    if (error) throw new Error(traduzErro(error.message))

    // Só há sessão imediata se a confirmação de email estiver desativada no Supabase
    if (authData.session && authData.user) {
      await new Promise(resolve => setTimeout(resolve, 500))
      await carregarPerfil(authData.user.id)
    }

    return { confirmacaoPendente: !authData.session }
  }

  const atualizarPerfil = async (campos: { name?: string; avatar_url?: string | null }): Promise<void> => {
    if (!perfil.value) return
    const { error } = await supabase
      .from('profiles')
      .update(campos)
      .eq('id', perfil.value.id)
    if (error) throw new Error(traduzErro(error.message))
    perfil.value = { ...perfil.value, ...campos }
  }

  const uploadAvatar = async (file: File): Promise<void> => {
    if (!perfil.value) return

    // Valida tipo e tamanho (máx 2 MB)
    if (!file.type.startsWith('image/')) throw new Error('O ficheiro tem de ser uma imagem.')
    if (file.size > 2 * 1024 * 1024) throw new Error('A imagem não pode ter mais de 2 MB.')

    const ext = file.name.split('.').pop()
    const path = `${perfil.value.id}/avatar.${ext}`

    // Faz upload (upsert substitui se já existir)
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) throw new Error(traduzErro(uploadError.message))

    // Gera URL pública e guarda no perfil
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    // Adiciona timestamp para forçar refresh da imagem no browser
    const avatarUrl = `${publicUrl}?t=${Date.now()}`

    await atualizarPerfil({ avatar_url: avatarUrl })
  }

  const pedirResetPassword = async (username: string): Promise<void> => {
    const { data: email, error: rpcError } = await supabase
      .rpc('get_email_by_username', { p_username: username.trim().toLowerCase() })

    if (rpcError) throw new Error(`Erro ao procurar utilizador: ${rpcError.message}`)
    if (!email) throw new Error('Utilizador não encontrado.')

    const { error } = await supabase.auth.resetPasswordForEmail(email as string, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/nova-password`,
    })
    if (error) throw new Error(traduzErro(error.message))
  }

  const atualizarPassword = async (novaPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: novaPassword })
    if (error) throw new Error(traduzErro(error.message))
  }

  // Alterar a password já autenticado (dentro do perfil). Reautentica com a
  // password atual para confirmar a identidade antes de a trocar.
  const alterarPasswordAutenticado = async (passwordAtual: string, novaPassword: string): Promise<void> => {
    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (!email) throw new Error('Sessão inválida. Faz login novamente.')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: passwordAtual })
    if (authError) throw new Error('A password atual está incorreta.')

    const { error } = await supabase.auth.updateUser({ password: novaPassword })
    if (error) throw new Error(traduzErro(error.message))
  }

  const alterarEmail = async (novoEmail: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
      email: novoEmail.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) throw new Error(traduzErro(error.message))
  }

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut()
    perfil.value = null
  }

  const isAdmin = computed(() => perfil.value?.admin === true)
  const isLoggedIn = computed(() => supabaseUser.value !== null)

  return {
    supabaseUser: readonly(supabaseUser),
    perfil: readonly(perfil),
    login,
    signup,
    usernameDisponivel,
    logout,
    pedirResetPassword,
    atualizarPassword,
    alterarPasswordAutenticado,
    alterarEmail,
    carregarPerfil,
    atualizarPerfil,
    uploadAvatar,
    isAdmin,
    isLoggedIn,
  }
}
