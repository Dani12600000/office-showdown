import type { Torneio, StatusInscricao, NumeroRonda } from '~/types/torneio'
import type { Utilizador } from '~/types/torneio'
import { JOGO_POR_RONDA, NOME_RONDA } from '~/types/torneio'
import type { Database } from '~/types/database.types'

export interface ParticipanteLobby {
  id: string
  torneio_id: string
  utilizador_id: string
  moedas: number
  status_inscricao: StatusInscricao
  utilizador: Utilizador
}

export interface Partida {
  id: string
  torneio_id: string
  ronda: number
  posicao: number
  jogador1_id: string | null
  jogador2_id: string | null
  vencedor_id: string | null
  estado: Record<string, any>
  status: 'A_JOGAR' | 'TERMINADO'
}

// Estado inicial de uma partida de Pedra-Papel-Tesoura (à melhor de 3)
export const estadoInicialPPT = () => ({
  sub_ronda: 1,
  escolha_j1: null,
  escolha_j2: null,
  pontos_j1: 0,
  pontos_j2: 0,
  historico: [] as { e1: string; e2: string; vencedor: string | null }[],
})

export const useLobby = (torneioId: string) => {
  const supabase = useSupabaseClient<Database>()
  const { perfil } = useAuth()

  const torneio = ref<Torneio | null>(null)
  const participantes = ref<ParticipanteLobby[]>([])
  const partidas = ref<Partida[]>([])
  const loading = ref(true)

  // Grupos derivados
  const confirmados = computed(() =>
    participantes.value.filter(p => p.status_inscricao === 'JOGADOR_CONFIRMADO')
  )
  const pendentes = computed(() =>
    participantes.value.filter(p => p.status_inscricao === 'QUER_JOGAR')
  )
  const plateia = computed(() =>
    participantes.value.filter(p => p.status_inscricao === 'PLATEIA')
  )

  const minhaParticipacao = computed(() =>
    participantes.value.find(p => p.utilizador_id === perfil.value?.id) ?? null
  )

  const podeIniciar = computed(() =>
    confirmados.value.length >= 2 && torneio.value?.status === 'LOBBY'
  )

  const jogoAtual = computed(() =>
    torneio.value ? JOGO_POR_RONDA[torneio.value.ronda_atual as NumeroRonda] : ''
  )
  const faseAtual = computed(() =>
    torneio.value ? NOME_RONDA[torneio.value.ronda_atual as NumeroRonda] : ''
  )

  // ---- Bracket / partidas ----
  const rondaAtual = computed(() => torneio.value?.ronda_atual ?? 1)

  const partidasRonda = computed(() =>
    partidas.value
      .filter(p => p.ronda === rondaAtual.value)
      .sort((a, b) => a.posicao - b.posicao)
  )

  // A partida ativa do utilizador na ronda atual
  const minhaPartida = computed(() =>
    partidasRonda.value.find(p =>
      (p.jogador1_id === perfil.value?.id || p.jogador2_id === perfil.value?.id)
      && p.status === 'A_JOGAR'
    ) ?? null
  )

  // Todas as partidas da ronda atual terminaram?
  const rondaTerminada = computed(() =>
    partidasRonda.value.length > 0 &&
    partidasRonda.value.every(p => p.status === 'TERMINADO')
  )

  // Lookup rápido de perfil por id (a partir dos participantes)
  const perfilDe = (id: string | null) =>
    id ? (participantes.value.find(p => p.utilizador_id === id)?.utilizador ?? null) : null

  // ---- Carregar dados ----
  const carregarLobby = async () => {
    // Passo 1 — torneio + participantes (sem join para evitar problemas com nome do FK)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('torneios').select('*').eq('id', torneioId).single(),
      supabase
        .from('torneio_participantes')
        .select('*')
        .eq('torneio_id', torneioId),
    ])

    torneio.value = t as Torneio | null

    // Partidas (árvore do torneio)
    const { data: parts } = await supabase
      .from('partidas')
      .select('*')
      .eq('torneio_id', torneioId)
    partidas.value = (parts ?? []) as Partida[]

    if (!p?.length) {
      participantes.value = []
      loading.value = false
      return
    }

    // Passo 2 — buscar os perfis dos participantes numa query separada
    const userIds = p.map(part => part.utilizador_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)

    const profileMap = new Map((profiles ?? []).map(pr => [pr.id, pr]))

    participantes.value = p.map(part => ({
      ...part,
      utilizador: profileMap.get(part.utilizador_id) ?? null,
    })) as ParticipanteLobby[]

    loading.value = false
  }

  // ---- Ações de admin ----
  const atualizarStatus = async (participanteId: string, novoStatus: StatusInscricao) => {
    const { data, error } = await supabase
      .from('torneio_participantes')
      .update({ status_inscricao: novoStatus })
      .eq('id', participanteId)
      .select()

    if (error) {
      console.error('[Lobby] Erro ao atualizar status:', error)
      throw new Error(error.message)
    }
    if (!data?.length) {
      // 0 linhas afetadas = RLS bloqueou o update (não és admin na BD?)
      throw new Error('Não foi possível atualizar. Verifica as permissões de admin.')
    }

    // Recarrega imediatamente — não depende do realtime
    await carregarLobby()
  }

  const confirmarJogador = (id: string) => atualizarStatus(id, 'JOGADOR_CONFIRMADO')
  const moverParaPlateia = (id: string) => atualizarStatus(id, 'PLATEIA')
  const colocarPendente  = (id: string) => atualizarStatus(id, 'QUER_JOGAR')

  // Cria pares para uma lista de jogadores (devolve linhas de partida)
  const gerarPartidas = (ids: string[], ronda: number) => {
    const linhas = []
    for (let i = 0; i < ids.length; i += 2) {
      const j1 = ids[i]
      const j2 = ids[i + 1] ?? null // ímpar → bye (avança automaticamente)
      linhas.push({
        torneio_id: torneioId,
        ronda,
        posicao: Math.floor(i / 2),
        jogador1_id: j1,
        jogador2_id: j2,
        vencedor_id: j2 ? null : j1,           // bye → vencedor é o j1
        status: j2 ? ('A_JOGAR' as const) : ('TERMINADO' as const),
        estado: estadoInicialPPT(),
      })
    }
    return linhas
  }

  const iniciarTorneio = async () => {
    if (!podeIniciar.value) return

    // Baralha os jogadores confirmados (sorteio automático)
    const ids = [...confirmados.value]
      .map(p => p.utilizador_id)
      .sort(() => Math.random() - 0.5)

    const { error: e1 } = await supabase.from('partidas').insert(gerarPartidas(ids, 1))
    if (e1) throw new Error(e1.message)

    const { error: e2 } = await supabase
      .from('torneios')
      .update({ status: 'JOGO', ronda_atual: 1 })
      .eq('id', torneioId)
    if (e2) throw new Error(e2.message)

    await carregarLobby()
  }

  // Avança para a próxima ronda a partir dos vencedores da ronda atual
  const avancarRonda = async () => {
    const r = rondaAtual.value
    const desta = partidasRonda.value
    if (!rondaTerminada.value) throw new Error('Ainda há partidas por terminar.')

    const vencedores = desta.map(p => p.vencedor_id).filter(Boolean) as string[]

    // Só sobra 1 → temos campeão
    if (vencedores.length <= 1) {
      const { error } = await supabase
        .from('torneios')
        .update({ status: 'FINAL', vencedor_id: vencedores[0] ?? null })
        .eq('id', torneioId)
      if (error) throw new Error(error.message)
      await carregarLobby()
      return
    }

    const { error: e1 } = await supabase.from('partidas').insert(gerarPartidas(vencedores, r + 1))
    if (e1) throw new Error(e1.message)

    const { error: e2 } = await supabase
      .from('torneios')
      .update({ ronda_atual: r + 1 })
      .eq('id', torneioId)
    if (e2) throw new Error(e2.message)

    await carregarLobby()
  }

  const criarTorneio = async (nome: string): Promise<string> => {
    const { data, error } = await supabase
      .from('torneios')
      .insert({
        nome,
        status: 'LOBBY',
        ronda_atual: 1,
        ativo: true,
        criado_por: perfil.value!.id,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return data.id
  }

  // ---- Realtime ----
  // Sem filtros — mais fiável (filtros precisam de REPLICA IDENTITY FULL).
  // carregarLobby já filtra por torneioId internamente.
  const canal = supabase
    .channel(`lobby-${torneioId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'torneios' }, carregarLobby)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'torneio_participantes' }, carregarLobby)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, carregarLobby)
    .subscribe((status) => {
      console.debug('[Lobby] Realtime status:', status)
    })

  onUnmounted(() => supabase.removeChannel(canal))

  return {
    torneio: readonly(torneio),
    participantes: readonly(participantes),
    partidas: readonly(partidas),
    confirmados,
    pendentes,
    plateia,
    minhaParticipacao,
    podeIniciar,
    jogoAtual,
    faseAtual,
    rondaAtual,
    partidasRonda,
    minhaPartida,
    rondaTerminada,
    perfilDe,
    loading: readonly(loading),
    carregarLobby,
    confirmarJogador,
    moverParaPlateia,
    colocarPendente,
    iniciarTorneio,
    avancarRonda,
    criarTorneio,
  }
}
