import type { Ref } from 'vue'
import { useCorePartida } from '~/composables/useCorePartida'

// Composable do Jogo do Galo (3×3) — usa o núcleo partilhado.
export const usePartidaGalo = (partidaId: string, comoId?: Ref<string | null>) => {
  const core = useCorePartida(partidaId, comoId)
  const { supabase, estado, controlo1, controlo2, jogador1, jogador2, carregar } = core

  const tabuleiro = computed<(1 | 2 | null)[]>(() => {
    const t = estado.value.tabuleiro
    return Array.isArray(t) && t.length === 9 ? t : Array(9).fill(null)
  })
  const vez = computed<1 | 2>(() => (estado.value.vez === 2 ? 2 : 1))
  const linhaVencedora = computed<number[] | null>(() => estado.value.linha_vencedora ?? null)
  const empates = computed<number>(() => estado.value.empates ?? 0)

  const minhaVez = computed(() => {
    if (vez.value === 1 && controlo1.value) return true
    if (vez.value === 2 && controlo2.value) return true
    return false
  })

  const jogadorDaVez = computed(() => vez.value === 1 ? jogador1.value : jogador2.value)

  // Quem é o jogador a quem eu controlo que joga AGORA?
  // (útil para personificação/admin: descobrir o id a passar à RPC)
  const idDaJogada = computed(() => {
    if (vez.value === 1 && controlo1.value) return jogador1.value?.id ?? null
    if (vez.value === 2 && controlo2.value) return jogador2.value?.id ?? null
    return null
  })

  const jogar = async (pos: number, jogadorId?: string) => {
    const { error } = await supabase.rpc('jogar_galo', {
      p_partida_id: partidaId,
      p_pos: pos,
      p_jogador_id: jogadorId ?? null,
    } as any)
    if (error) throw new Error(error.message)
    await carregar()
  }

  return {
    ...core,
    tabuleiro, vez, linhaVencedora, empates,
    minhaVez, jogadorDaVez, idDaJogada,
    jogar,
  }
}
