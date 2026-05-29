import type { Torneio, StatusInscricao, NumeroRonda, JogoTipo } from '~/types/torneio'
import type { Utilizador } from '~/types/torneio'
import { NOME_RONDA, JOGOS_CATALOGO, JOGOS_RONDA_DEFAULT } from '~/types/torneio'
import type { Database } from '~/types/database.types'

export interface ParticipanteLobby {
  id: string
  torneio_id: string
  utilizador_id: string
  moedas: number
  status_inscricao: StatusInscricao
  preferencia: 'JOGAR' | 'PLATEIA'
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
  revelar_ate?: string | null
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

// Estado inicial de uma partida de Jogo do Galo (3×3)
export const estadoInicialGalo = () => ({
  tabuleiro: Array(9).fill(null) as (1 | 2 | null)[],
  vez: 1 as 1 | 2,
  comeca: 1 as 1 | 2,
  empates: 0,
  linha_vencedora: null as number[] | null,
})

// Estado inicial por tipo de jogo
export const estadoInicialDe = (tipo: JogoTipo) => {
  switch (tipo) {
    case 'GALO': return estadoInicialGalo()
    default:     return estadoInicialPPT()
  }
}

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

  const maxJogadores = computed(() => torneio.value?.max_jogadores ?? 16)
  const confirmadosCheios = computed(() => confirmados.value.length >= maxJogadores.value)

  const podeIniciar = computed(() =>
    confirmados.value.length >= 2 &&
    confirmados.value.length <= maxJogadores.value &&
    torneio.value?.status === 'LOBBY'
  )

  // Config de jogos por ronda (escolhida pelo admin)
  const jogosRonda = computed<Record<string, JogoTipo>>(() =>
    (torneio.value?.jogos_ronda as any) ?? JOGOS_RONDA_DEFAULT
  )
  const jogoTipoDe = (ronda: number): JogoTipo => jogosRonda.value[String(ronda)] ?? 'PPT'
  const jogoAtualTipo = computed(() => torneio.value ? jogoTipoDe(torneio.value.ronda_atual) : 'PPT')

  const jogoAtual = computed(() =>
    torneio.value ? JOGOS_CATALOGO[jogoAtualTipo.value].nome : ''
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

  // Partida em destaque no projetor
  const partidaDestaque = computed(() =>
    partidas.value.find(p => p.id === torneio.value?.partida_destaque_id) ?? null
  )

  const destacarPartida = async (partidaId: string | null) => {
    const { error } = await supabase
      .from('torneios')
      .update({ partida_destaque_id: partidaId })
      .eq('id', torneioId)
    if (error) throw new Error(error.message)
    await carregarLobby()
  }

  // Auto-limpar o destaque 4s depois da revelação terminar — palco fica
  // sempre "limpinho" entre partidas. Qualquer cliente tenta; só admins
  // passam o RLS, mas o UPDATE é idempotente. Rastreado por id da partida
  // para não duplicar tentativas.
  let limparTimer: ReturnType<typeof setTimeout> | null = null
  let destaqueAgendado: string | null = null
  watch(partidaDestaque, (p) => {
    if (limparTimer) { clearTimeout(limparTimer); limparTimer = null }
    if (!p || p.status !== 'TERMINADO') { destaqueAgendado = null; return }
    if (destaqueAgendado === p.id) return

    const fimRevelacao = p.revelar_ate ? new Date(p.revelar_ate).getTime() : Date.now()
    const delay = Math.max(0, fimRevelacao - Date.now() + 4000)

    destaqueAgendado = p.id
    limparTimer = setTimeout(async () => {
      // Só limpa se ainda for esta a partida em destaque
      if (torneio.value?.partida_destaque_id !== p.id) return
      try {
        await supabase
          .from('torneios')
          .update({ partida_destaque_id: null })
          .eq('id', torneioId)
      } catch { /* sem permissão (não-admin) → ignora */ }
    }, delay)
  })

  // Escolhe uma partida aleatória da ronda (prefere as que ainda estão a jogar)
  const destacarAleatoria = async () => {
    const candidatas = partidasRonda.value.filter(p => p.status === 'A_JOGAR')
    const pool = candidatas.length ? candidatas : [...partidasRonda.value]
    if (!pool.length) return
    const escolhida = pool[Math.floor(Math.random() * pool.length)]
    await destacarPartida(escolhida.id)
  }

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

  // Update sem reload (para operações em lote)
  const setStatus = async (id: string, status: StatusInscricao) => {
    const { error } = await supabase
      .from('torneio_participantes')
      .update({ status_inscricao: status })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  // Define o máximo de jogadores (potências de 2)
  const definirMax = async (n: number) => {
    const { error } = await supabase.from('torneios').update({ max_jogadores: n }).eq('id', torneioId)
    if (error) throw new Error(error.message)
    await carregarLobby()
  }

  // Número de rondas com base no máximo (potência de 2): 16→4, 8→3, 4→2, 2→1
  const numRondas = computed(() => Math.max(1, Math.round(Math.log2(maxJogadores.value))))

  // Define o jogo de uma ronda específica
  const definirJogoRonda = async (ronda: number, tipo: JogoTipo) => {
    const novo = { ...jogosRonda.value, [String(ronda)]: tipo }
    const { error } = await supabase.from('torneios').update({ jogos_ronda: novo }).eq('id', torneioId)
    if (error) throw new Error(error.message)
    await carregarLobby()
  }

  // Define a PREFERÊNCIA de um participante (admin a personificar bots).
  // Utilizadores reais não-admin usam `definirMinhaPreferencia` em vez disto.
  const definirPreferencia = async (participanteId: string, pref: 'JOGAR' | 'PLATEIA') => {
    const { error } = await supabase
      .from('torneio_participantes')
      .update({ preferencia: pref })
      .eq('id', participanteId)
    if (error) throw new Error(error.message)
    await carregarLobby()
  }

  // O próprio utilizador define a sua preferência (via RPC — não precisa de RLS admin).
  // A RPC valida que o torneio está em LOBBY e que o admin ainda não decidiu.
  const definirMinhaPreferencia = async (pref: 'JOGAR' | 'PLATEIA') => {
    const { error } = await supabase.rpc('definir_minha_preferencia', {
      p_torneio_id: torneioId,
      p_pref: pref,
    } as any)
    if (error) throw new Error(error.message)
    await carregarLobby()
  }

  // Preenche os lugares em falta — prioriza quem prefere JOGAR, depois quem prefere PLATEIA
  const preencherAteMax = async () => {
    const faltam = maxJogadores.value - confirmados.value.length
    if (faltam <= 0) return
    const pool = [...pendentes.value, ...plateia.value]
      .sort((a, b) => (a.preferencia === 'JOGAR' ? 0 : 1) - (b.preferencia === 'JOGAR' ? 0 : 1))
    for (const p of pool.slice(0, faltam)) await setStatus(p.id, 'JOGADOR_CONFIRMADO')
    await carregarLobby()
  }

  // Sorteia o elenco respeitando preferências:
  // os que querem jogar têm prioridade para os `max` lugares; se faltarem, puxa dos que preferiam plateia.
  const sortearElenco = async () => {
    const max = maxJogadores.value
    const querem  = participantes.value.filter(p => p.preferencia === 'JOGAR').sort(() => Math.random() - 0.5)
    const naoQuer = participantes.value.filter(p => p.preferencia === 'PLATEIA').sort(() => Math.random() - 0.5)
    const dentro = new Set([...querem, ...naoQuer].slice(0, max).map(p => p.id))
    for (const p of participantes.value) {
      const novo: StatusInscricao = dentro.has(p.id) ? 'JOGADOR_CONFIRMADO' : 'PLATEIA'
      if (p.status_inscricao !== novo) await setStatus(p.id, novo)
    }
    await carregarLobby()
  }

  // Adiciona um bot em "aguardar" (o admin personifica-o para escolher jogar/plateia)
  const adicionarBot = async (nome?: string) => {
    const nBots = participantes.value.filter(p => p.utilizador?.is_bot).length
    const { error } = await supabase.rpc('adicionar_bot', {
      p_torneio_id: torneioId,
      p_nome: nome || `Bot ${nBots + 1}`,
    })
    if (error) throw new Error(error.message)
    await carregarLobby()
  }

  // Cria pares para uma lista de jogadores (devolve linhas de partida)
  const gerarPartidas = (ids: string[], ronda: number) => {
    const tipo = jogoTipoDe(ronda)
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
        estado: estadoInicialDe(tipo),
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

    // Entra em ARVORE: mostra a revelação dos confrontos antes de jogar
    const { error: e2 } = await supabase
      .from('torneios')
      .update({ status: 'ARVORE', ronda_atual: 1 })
      .eq('id', torneioId)
    if (e2) throw new Error(e2.message)

    await carregarLobby()
  }

  // Da revelação (ARVORE) para os jogos a sério (JOGO)
  const comecarJogos = async () => {
    const { error } = await supabase
      .from('torneios')
      .update({ status: 'JOGO' })
      .eq('id', torneioId)
    if (error) throw new Error(error.message)
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

    // Volta a ARVORE para revelar os confrontos da nova ronda
    const { error: e2 } = await supabase
      .from('torneios')
      .update({ ronda_atual: r + 1, status: 'ARVORE' })
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

  // Rede de segurança: recarrega ao voltar/focar a aba (abas em background perdem eventos de realtime)
  if (import.meta.client) {
    useEventListener(window, 'focus', () => carregarLobby())
    useEventListener(document, 'visibilitychange', () => { if (!document.hidden) carregarLobby() })
  }

  onUnmounted(() => {
    supabase.removeChannel(canal)
    if (limparTimer) clearTimeout(limparTimer)
  })

  return {
    torneio: readonly(torneio),
    participantes: readonly(participantes),
    partidas: readonly(partidas),
    confirmados,
    pendentes,
    plateia,
    minhaParticipacao,
    podeIniciar,
    maxJogadores,
    confirmadosCheios,
    jogoAtual,
    jogoAtualTipo,
    jogosRonda,
    jogoTipoDe,
    numRondas,
    faseAtual,
    rondaAtual,
    partidasRonda,
    minhaPartida,
    rondaTerminada,
    perfilDe,
    partidaDestaque,
    destacarPartida,
    destacarAleatoria,
    loading: readonly(loading),
    carregarLobby,
    confirmarJogador,
    moverParaPlateia,
    colocarPendente,
    adicionarBot,
    definirMax,
    definirJogoRonda,
    definirPreferencia,
    definirMinhaPreferencia,
    preencherAteMax,
    sortearElenco,
    iniciarTorneio,
    comecarJogos,
    avancarRonda,
    criarTorneio,
  }
}
