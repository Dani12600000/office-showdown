import type { Utilizador } from '~/types/torneio'
import type { Database } from '~/types/database.types'

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

    if (authError) throw new Error(authError.message)

    // Carrega o perfil imediatamente após login (antes do navigateTo)
    if (authData.user) {
      await carregarPerfil(authData.user.id)
    }
  }

  const signup = async (username: string, name: string, email: string, password: string): Promise<{ confirmacaoPendente: boolean }> => {
    const usernameClean = username.trim().toLowerCase()

    const { data: existe } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', usernameClean)
      .maybeSingle()

    if (existe) throw new Error('Este username já está a ser utilizado.')

    const { data: authData, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { username: usernameClean, name, admin: false },
        redirectTo: `${window.location.origin}/`,
      },
    })

    if (error) throw new Error(error.message)

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
    if (error) throw new Error(error.message)
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

    if (uploadError) throw new Error(uploadError.message)

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
    if (error) throw new Error(error.message)
  }

  const atualizarPassword = async (novaPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: novaPassword })
    if (error) throw new Error(error.message)
  }

  const alterarEmail = async (novoEmail: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
      email: novoEmail.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) throw new Error(error.message)
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
    logout,
    pedirResetPassword,
    atualizarPassword,
    alterarEmail,
    carregarPerfil,
    atualizarPerfil,
    uploadAvatar,
    isAdmin,
    isLoggedIn,
  }
}
