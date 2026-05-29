import type { Utilizador } from '~/types/torneio'

// Plugin async: Nuxt espera que este termine antes de renderizar qualquer página.
// Garante que o perfil está sempre disponível, mesmo após refresh.
export default defineNuxtPlugin(async () => {
  const supabase = useSupabaseClient()
  const perfil = useState<Utilizador | null>('perfil_atual', () => null)

  const carregarPerfil = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    perfil.value = (data as Utilizador) ?? null
  }

  // Sessão existente (refresh de página)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await carregarPerfil(user.id)
  }

  // Mudanças futuras de estado (login, logout, refresh de token)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      // Só recarrega se mudar de utilizador ou perfil estiver em falta
      if (!perfil.value || perfil.value.id !== session.user.id) {
        await carregarPerfil(session.user.id)
      }
    } else {
      perfil.value = null
    }
  })
})
