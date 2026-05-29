import type { Ref } from 'vue'
import { useCorePartida } from '~/composables/useCorePartida'

export type EscolhaPPT = 'pedra' | 'papel' | 'tesoura'

// Composable do Pedra-Papel-Tesoura (à melhor de 3) — usa o núcleo partilhado.
export const usePartida = (partidaId: string, comoId?: Ref<string | null>) => {
  const core = useCorePartida(partidaId, comoId)
  const { supabase, estado, souJogador1, souJogador2, carregar } = core

  const escolha1 = computed<EscolhaPPT | null>(() => estado.value.escolha_j1 ?? null)
  const escolha2 = computed<EscolhaPPT | null>(() => estado.value.escolha_j2 ?? null)
  const pontos1 = computed(() => estado.value.pontos_j1 ?? 0)
  const pontos2 = computed(() => estado.value.pontos_j2 ?? 0)
  const subRonda = computed(() => estado.value.sub_ronda ?? 1)

  const minhaEscolha = computed<EscolhaPPT | null>(() => {
    if (souJogador1.value) return estado.value.escolha_j1 ?? null
    if (souJogador2.value) return estado.value.escolha_j2 ?? null
    return null
  })
  const jaEscolhi = computed(() => minhaEscolha.value !== null)

  const adversarioEscolheu = computed(() => {
    if (souJogador1.value) return estado.value.escolha_j2 !== null && estado.value.escolha_j2 !== undefined
    if (souJogador2.value) return estado.value.escolha_j1 !== null && estado.value.escolha_j1 !== undefined
    return false
  })

  const ultimaJogada = computed(() => {
    const h = estado.value.historico ?? []
    return h.length ? h[h.length - 1] : null
  })

  const jogar = async (escolha: EscolhaPPT, jogadorId?: string) => {
    const { error } = await supabase.rpc('jogar_ppt', {
      p_partida_id: partidaId,
      p_escolha: escolha,
      p_jogador_id: jogadorId ?? null,
    } as any)
    if (error) throw new Error(error.message)
    await carregar()
  }

  return {
    ...core,
    escolha1, escolha2, pontos1, pontos2, subRonda,
    minhaEscolha, jaEscolhi, adversarioEscolheu, ultimaJogada,
    jogar,
  }
}
