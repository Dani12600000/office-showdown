import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'

// "Já apostei tudo o que queria" — sinal EFÉMERO (não toca na BD).
// Corre sobre o websocket de Realtime do Supabase via PRESENCE:
//   - cada telemóvel que pode apostar faz `track({ pronto, partidaId })`;
//   - o estado atual é sincronizado para quem entrar/recarregar (host incluído);
//   - desliga-se sozinho quando alguém fecha a aba (sem contagens fantasma).
//
// Dois modos (opção `participar`):
//   - participar=true  → este cliente entra na contagem (apostador/bot personificado);
//   - participar=false → só observa (o anfitrião a ver o painel, o projetor).
//
// Regra de ouro: bots = jogadores reais. Os bots personificados (?como=botId)
// participam como qualquer humano — contam para o total e têm o botão.

type MetaPronto = { pronto: boolean; partidaId: string | null }

export function useApostasProntos(opts: {
  torneioId: string
  euId: Ref<string | null>
  partidaId: Ref<string | null>
  participar: Ref<boolean>
}) {
  const { torneioId, euId, partidaId, participar } = opts
  const supabase = useSupabaseClient<Database>()

  const euPronto = ref(false)
  // Estado de presença espelhado: chave (utilizador) → meta mais recente.
  const estado = ref<Record<string, MetaPronto>>({})

  // Só conta no cliente (SSR não tem websocket).
  if (!import.meta.client) {
    return { euPronto, prontos: ref(0), total: ref(0), todosProntos: ref(false), marcar: (_: boolean) => {} }
  }

  const canal = supabase.channel(`apostas-prontos-${torneioId}`, {
    config: { presence: { key: euId.value ?? `anon-${Math.random().toString(36).slice(2)}` } },
  })

  const sincronizar = () => {
    const novo: Record<string, MetaPronto> = {}
    const st = canal.presenceState() as Record<string, MetaPronto[]>
    for (const chave in st) {
      const metas = st[chave] ?? []
      const m = metas[metas.length - 1] // meta mais recente desta presença
      if (m) novo[chave] = { pronto: !!m.pronto, partidaId: m.partidaId ?? null }
    }
    estado.value = novo
  }

  // Envia/atualiza o meu estado (só se for participante).
  const enviar = () => {
    if (!participar.value) return
    canal.track({ pronto: euPronto.value, partidaId: partidaId.value } satisfies MetaPronto)
  }

  canal
    .on('presence', { event: 'sync' }, sincronizar)
    .subscribe((status) => { if (status === 'SUBSCRIBED') enviar() })

  // Toggle do botão "Já apostei tudo".
  const marcar = (v: boolean) => { euPronto.value = v; enviar() }

  // Novo confronto no palco → recomeça a ronda de apostas: volto a "não pronto".
  watch(partidaId, () => { euPronto.value = false; enviar() })
  // Mudei de identidade/participação (ex.: deixei de poder apostar) → re-track.
  watch([euId, participar], () => {
    if (participar.value) enviar()
    else canal.untrack()
  })

  // Contagens derivadas (só presenças marcadas para a partida atual contam como prontas).
  const total = computed(() => Object.keys(estado.value).length)
  const prontos = computed(() =>
    Object.values(estado.value).filter(m => m.pronto && m.partidaId === partidaId.value).length,
  )
  const todosProntos = computed(() => total.value > 0 && prontos.value >= total.value)

  onUnmounted(() => { supabase.removeChannel(canal) })

  return { euPronto, prontos, total, todosProntos, marcar }
}
