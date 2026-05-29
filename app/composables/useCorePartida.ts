import type { Ref } from 'vue'
import type { Utilizador, JogoTipo } from '~/types/torneio'
import { JOGOS_CATALOGO, JOGOS_RONDA_DEFAULT } from '~/types/torneio'
import type { Partida } from '~/composables/useLobby'
import type { Database } from '~/types/database.types'

// Núcleo partilhado pelos vários jogos (PPT, Galo, …): carrega a partida,
// resolve quem controla cada slot, expõe estado de destaque/revelação/vencedor
// e gere a subscrição realtime. Cada jogo cria a sua camada por cima (estado
// específico + função `jogar`).
export const useCorePartida = (partidaId: string, comoId?: Ref<string | null>) => {
  const supabase = useSupabaseClient<Database>()
  const { perfil, isAdmin } = useAuth()
  const como = comoId ?? ref<string | null>(null)

  const partida = ref<Partida | null>(null)
  const jogador1 = ref<Utilizador | null>(null)
  const jogador2 = ref<Utilizador | null>(null)
  const loading = ref(true)
  const destaqueId = ref<string | null>(null)
  const jogoTipo = ref<JogoTipo>('PPT')

  const estado = computed<any>(() => partida.value?.estado ?? {})

  const souJogador1 = computed(() => partida.value?.jogador1_id === perfil.value?.id)
  const souJogador2 = computed(() => partida.value?.jogador2_id === perfil.value?.id)
  const souJogador  = computed(() => souJogador1.value || souJogador2.value)

  const j1Bot = computed(() => jogador1.value?.is_bot ?? false)
  const j2Bot = computed(() => jogador2.value?.is_bot ?? false)

  // Em modo personificação (?como=botId) só controlo esse slot;
  // caso contrário controlo o meu + bots (se admin).
  const controlo1 = computed(() => {
    if (como.value) return partida.value?.jogador1_id === como.value
    return souJogador1.value || (isAdmin.value && j1Bot.value)
  })
  const controlo2 = computed(() => {
    if (como.value) return partida.value?.jogador2_id === como.value
    return souJogador2.value || (isAdmin.value && j2Bot.value)
  })
  const souEspectador = computed(() => !controlo1.value && !controlo2.value)
  const controloBots = computed(() =>
    (controlo1.value && j1Bot.value) || (controlo2.value && j2Bot.value)
  )

  const terminada = computed(() => partida.value?.status === 'TERMINADO')
  const vencedor = computed(() => {
    if (!terminada.value) return null
    return partida.value?.vencedor_id === jogador1.value?.id ? jogador1.value : jogador2.value
  })
  const perdedor = computed(() => {
    if (!terminada.value) return null
    return partida.value?.vencedor_id === jogador1.value?.id ? jogador2.value : jogador1.value
  })
  // venci/perdi baseiam-se em quem CONTROLO (não no perfil), para que
  // bots personificados e jogadores reais tenham o mesmo comportamento.
  // Se controlo ambos os lados (admin sem ?como=), o resultado é neutro.
  const ambosOsLados = computed(() => controlo1.value && controlo2.value)
  const venci = computed(() => {
    if (!terminada.value || !partida.value?.vencedor_id) return false
    if (ambosOsLados.value) return false
    const v = partida.value.vencedor_id
    return (controlo1.value && v === jogador1.value?.id) ||
           (controlo2.value && v === jogador2.value?.id)
  })
  const perdi = computed(() => {
    if (!terminada.value) return false
    if (venci.value || ambosOsLados.value) return false
    return controlo1.value || controlo2.value
  })

  // Revelação sincronizada (5s definidos pelo servidor) — usado por todos os jogos
  const agora = useAgora()
  const revelarAte = computed(() => {
    const r = partida.value?.revelar_ate
    return r ? new Date(r).getTime() : 0
  })
  const revelando = computed(() => revelarAte.value > agora.value)
  const vitoriaVisivel = computed(() => terminada.value && !revelando.value)

  const emDestaque = computed(() => destaqueId.value === partidaId)
  const jogoNome = computed(() => JOGOS_CATALOGO[jogoTipo.value].nome)
  const jogoDisponivel = computed(() => JOGOS_CATALOGO[jogoTipo.value].disponivel)

  const carregar = async () => {
    const { data } = await supabase.from('partidas').select('*').eq('id', partidaId).single()
    partida.value = data as Partida | null

    if (data) {
      const ids = [data.jogador1_id, data.jogador2_id].filter(Boolean) as string[]
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids)
      jogador1.value = profs?.find(p => p.id === data.jogador1_id) ?? null
      jogador2.value = profs?.find(p => p.id === data.jogador2_id) ?? null

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

  // Realtime
  const canal = supabase
    .channel(`partida-${partidaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, carregar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'torneios' }, carregar)
    .subscribe((status) => console.debug('[Partida] Realtime:', status))

  // Rede de segurança ao focar/voltar à janela
  if (import.meta.client) {
    useEventListener(window, 'focus', () => carregar())
    useEventListener(document, 'visibilitychange', () => { if (!document.hidden) carregar() })
  }

  onUnmounted(() => supabase.removeChannel(canal))

  return {
    supabase, perfil, isAdmin, como,
    partida, jogador1, jogador2, loading,
    estado,
    souJogador, souJogador1, souJogador2,
    j1Bot, j2Bot, controlo1, controlo2, souEspectador, controloBots,
    terminada, vencedor, perdedor, venci, perdi,
    revelando, vitoriaVisivel,
    emDestaque, jogoTipo, jogoNome, jogoDisponivel,
    carregar,
  }
}
