import type { Ref } from 'vue'
import type { Utilizador, JogoTipo } from '~/types/torneio'
import { JOGOS_CATALOGO, JOGOS_RONDA_DEFAULT } from '~/types/torneio'
import type { Partida } from '~/composables/useLobby'
import type { Database } from '~/types/database.types'

export type EscolhaPPT = 'pedra' | 'papel' | 'tesoura'

// comoId: se definido, a página comporta-se como esse jogador (bot) — só controla esse slot.
export const usePartida = (partidaId: string, comoId?: Ref<string | null>) => {
  const supabase = useSupabaseClient<Database>()
  const { perfil, isAdmin } = useAuth()
  const como = comoId ?? ref<string | null>(null)

  const partida = ref<Partida | null>(null)
  const jogador1 = ref<Utilizador | null>(null)
  const jogador2 = ref<Utilizador | null>(null)
  const loading = ref(true)

  const estado = computed<any>(() => partida.value?.estado ?? {})

  const souJogador1 = computed(() => partida.value?.jogador1_id === perfil.value?.id)
  const souJogador2 = computed(() => partida.value?.jogador2_id === perfil.value?.id)
  const souJogador  = computed(() => souJogador1.value || souJogador2.value)

  // Bots da partida
  const j1Bot = computed(() => jogador1.value?.is_bot ?? false)
  const j2Bot = computed(() => jogador2.value?.is_bot ?? false)

  // Que slots é que EU posso controlar.
  // Em modo personificação (como) só controlo esse jogador; caso contrário o meu + bots (se admin).
  const controlo1 = computed(() => {
    if (como.value) return partida.value?.jogador1_id === como.value
    return souJogador1.value || (isAdmin.value && j1Bot.value)
  })
  const controlo2 = computed(() => {
    if (como.value) return partida.value?.jogador2_id === como.value
    return souJogador2.value || (isAdmin.value && j2Bot.value)
  })
  const souEspectador = computed(() => !controlo1.value && !controlo2.value)

  // Controlo pelo menos um bot? (admin pode jogá-los a qualquer momento, sem precisar de estar em destaque)
  const controloBots = computed(() =>
    (controlo1.value && j1Bot.value) || (controlo2.value && j2Bot.value)
  )

  // Escolhas atuais (sub-ronda em curso)
  const escolha1 = computed<EscolhaPPT | null>(() => estado.value.escolha_j1 ?? null)
  const escolha2 = computed<EscolhaPPT | null>(() => estado.value.escolha_j2 ?? null)

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

  // Fase de revelação (5s definidos pelo servidor) — sincronizada entre janelas
  const agora = useAgora()
  const revelarAte = computed(() => {
    const r = partida.value?.revelar_ate
    return r ? new Date(r).getTime() : 0
  })
  const revelando = computed(() => revelarAte.value > agora.value)
  // Só mostra o vencedor depois da revelação terminar
  const vitoriaVisivel = computed(() => terminada.value && !revelando.value)

  // Esta partida está a ser apresentada no projetor?
  const destaqueId = ref<string | null>(null)
  const emDestaque = computed(() => destaqueId.value === partidaId)

  // Tipo de jogo desta ronda (configurado pelo admin)
  const jogoTipo = ref<JogoTipo>('PPT')
  const jogoNome = computed(() => JOGOS_CATALOGO[jogoTipo.value].nome)
  const jogoDisponivel = computed(() => jogoTipo.value === 'PPT') // só PPT está jogável

  // ---- Carregar ----
  const carregar = async () => {
    const { data } = await supabase.from('partidas').select('*').eq('id', partidaId).single()
    partida.value = data as Partida | null

    if (data) {
      const ids = [data.jogador1_id, data.jogador2_id].filter(Boolean) as string[]
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids)
      jogador1.value = profs?.find(p => p.id === data.jogador1_id) ?? null
      jogador2.value = profs?.find(p => p.id === data.jogador2_id) ?? null

      // Partida em destaque + jogo configurado para esta ronda
      // select('*') é resiliente caso a coluna jogos_ronda ainda não exista
      const { data: t, error: tErr } = await supabase
        .from('torneios')
        .select('*')
        .eq('id', data.torneio_id)
        .single()
      if (tErr) console.error('[Partida] Erro a carregar torneio:', tErr)
      destaqueId.value = (t as any)?.partida_destaque_id ?? null
      const config = (t as any)?.jogos_ronda ?? JOGOS_RONDA_DEFAULT
      jogoTipo.value = config[String((data as Partida).ronda)] ?? 'PPT'
    }
    loading.value = false
  }

  // ---- Jogar (via RPC atómica no servidor) ----
  // jogadorId: opcional. Se for um bot e fores admin, jogas por ele.
  const jogar = async (escolha: EscolhaPPT, jogadorId?: string) => {
    const { error } = await supabase.rpc('jogar_ppt', {
      p_partida_id: partidaId,
      p_escolha: escolha,
      p_jogador_id: jogadorId ?? null,
    } as any)
    if (error) throw new Error(error.message)
    await carregar()
  }

  // ---- Realtime ----
  const canal = supabase
    .channel(`partida-${partidaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, carregar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'torneios' }, carregar)
    .subscribe((status) => console.debug('[Partida] Realtime:', status))

  // Rede de segurança: recarrega ao focar/voltar à janela (caso o realtime falhe um evento)
  if (import.meta.client) {
    useEventListener(window, 'focus', () => carregar())
    useEventListener(document, 'visibilitychange', () => { if (!document.hidden) carregar() })
  }

  onUnmounted(() => supabase.removeChannel(canal))

  return {
    partida, jogador1, jogador2, loading,
    estado, souJogador, souJogador1, souJogador2,
    j1Bot, j2Bot, controlo1, controlo2, souEspectador, controloBots,
    escolha1, escolha2,
    pontos1, pontos2, subRonda,
    minhaEscolha, jaEscolhi, adversarioEscolheu,
    ultimaJogada, terminada, vencedor, venci,
    emDestaque, revelando, vitoriaVisivel,
    jogoTipo, jogoNome, jogoDisponivel,
    carregar, jogar,
  }
}
