import type { Utilizador } from '~/types/torneio'
import type { Partida } from '~/composables/useLobby'
import type { Database } from '~/types/database.types'

export type EscolhaPPT = 'pedra' | 'papel' | 'tesoura'

export const usePartida = (partidaId: string) => {
  const supabase = useSupabaseClient<Database>()
  const { perfil } = useAuth()

  const partida = ref<Partida | null>(null)
  const jogador1 = ref<Utilizador | null>(null)
  const jogador2 = ref<Utilizador | null>(null)
  const loading = ref(true)

  const estado = computed<any>(() => partida.value?.estado ?? {})

  const souJogador1 = computed(() => partida.value?.jogador1_id === perfil.value?.id)
  const souJogador2 = computed(() => partida.value?.jogador2_id === perfil.value?.id)
  const souJogador  = computed(() => souJogador1.value || souJogador2.value)

  const pontos1 = computed(() => estado.value.pontos_j1 ?? 0)
  const pontos2 = computed(() => estado.value.pontos_j2 ?? 0)
  const subRonda = computed(() => estado.value.sub_ronda ?? 1)

  // A minha escolha atual (se já joguei nesta sub-ronda)
  const minhaEscolha = computed<EscolhaPPT | null>(() => {
    if (souJogador1.value) return estado.value.escolha_j1 ?? null
    if (souJogador2.value) return estado.value.escolha_j2 ?? null
    return null
  })
  const jaEscolhi = computed(() => minhaEscolha.value !== null)

  // O adversário já escolheu?
  const adversarioEscolheu = computed(() => {
    if (souJogador1.value) return estado.value.escolha_j2 !== null && estado.value.escolha_j2 !== undefined
    if (souJogador2.value) return estado.value.escolha_j1 !== null && estado.value.escolha_j1 !== undefined
    return false
  })

  // Última jogada resolvida (para mostrar o resultado)
  const ultimaJogada = computed(() => {
    const h = estado.value.historico ?? []
    return h.length ? h[h.length - 1] : null
  })

  const terminada = computed(() => partida.value?.status === 'TERMINADO')
  const vencedor = computed(() => {
    if (!terminada.value) return null
    return partida.value?.vencedor_id === jogador1.value?.id ? jogador1.value : jogador2.value
  })
  const venci = computed(() => terminada.value && partida.value?.vencedor_id === perfil.value?.id)

  // ---- Carregar ----
  const carregar = async () => {
    const { data } = await supabase.from('partidas').select('*').eq('id', partidaId).single()
    partida.value = data as Partida | null

    if (data) {
      const ids = [data.jogador1_id, data.jogador2_id].filter(Boolean) as string[]
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids)
      jogador1.value = profs?.find(p => p.id === data.jogador1_id) ?? null
      jogador2.value = profs?.find(p => p.id === data.jogador2_id) ?? null
    }
    loading.value = false
  }

  // ---- Jogar (via RPC atómica no servidor) ----
  const jogar = async (escolha: EscolhaPPT) => {
    const { error } = await supabase.rpc('jogar_ppt', {
      p_partida_id: partidaId,
      p_escolha: escolha,
    })
    if (error) throw new Error(error.message)
    await carregar()
  }

  // ---- Realtime ----
  const canal = supabase
    .channel(`partida-${partidaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, carregar)
    .subscribe()

  onUnmounted(() => supabase.removeChannel(canal))

  return {
    partida, jogador1, jogador2, loading,
    estado, souJogador, souJogador1, souJogador2,
    pontos1, pontos2, subRonda,
    minhaEscolha, jaEscolhi, adversarioEscolheu,
    ultimaJogada, terminada, vencedor, venci,
    carregar, jogar,
  }
}
