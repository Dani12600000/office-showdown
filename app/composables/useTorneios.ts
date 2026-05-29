import type { Torneio, TorneioParticipante, StatusInscricao } from '~/types/torneio'
import { JOGO_POR_RONDA, NOME_RONDA } from '~/types/torneio'
import type { Database } from '~/types/database.types'

export interface TorneioCard extends Torneio {
  total_participantes: number
  minha_participacao: Pick<TorneioParticipante, 'status_inscricao' | 'moedas'> | null
}

export const useTorneios = () => {
  const supabase = useSupabaseClient<Database>()
  const { perfil } = useAuth()

  const torneios = ref<TorneioCard[]>([])
  const loading = ref(false)

  const carregarTorneios = async () => {
    if (!perfil.value) return
    loading.value = true

    const [{ data: torneiosData }, { data: participacoes }] = await Promise.all([
      // Todos os torneios ativos com contagem de participantes
      supabase
        .from('torneios')
        .select('*, torneio_participantes(count)')
        .eq('ativo', true)
        .order('created_at', { ascending: false }),

      // As minhas participações
      supabase
        .from('torneio_participantes')
        .select('torneio_id, status_inscricao, moedas')
        .eq('utilizador_id', perfil.value.id),
    ])

    const mapaParticipacoes = new Map(
      (participacoes ?? []).map((p) => [p.torneio_id, p])
    )

    torneios.value = (torneiosData ?? []).map((t: any) => ({
      ...t,
      total_participantes: t.torneio_participantes?.[0]?.count ?? 0,
      minha_participacao: mapaParticipacoes.get(t.id) ?? null,
    }))

    loading.value = false
  }

  const inscreverMe = async (
    torneioId: string,
    status: StatusInscricao = 'QUER_JOGAR',
  ) => {
    if (!perfil.value) return
    const { error } = await supabase
      .from('torneio_participantes')
      .insert({
        torneio_id: torneioId,
        utilizador_id: perfil.value.id,
        status_inscricao: status,
        moedas: 100,
      })
    if (error) throw new Error(error.message)
    await carregarTorneios()
  }

  // Realtime — atualiza quando torneios ou participações mudam
  const canal = supabase
    .channel('torneios-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'torneios' }, carregarTorneios)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'torneio_participantes' }, carregarTorneios)
    .subscribe()

  onUnmounted(() => {
    supabase.removeChannel(canal)
  })

  return {
    torneios: readonly(torneios),
    loading: readonly(loading),
    carregarTorneios,
    inscreverMe,
    JOGO_POR_RONDA,
    NOME_RONDA,
  }
}
