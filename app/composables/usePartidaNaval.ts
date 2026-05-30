import type { Ref } from 'vue'
import { useCorePartida } from '~/composables/useCorePartida'

export type CasaNaval = 'agua' | 'acerto' | null

// Frota: tamanhos variados. Total = 6 casas.
export const NAVIOS_NAVAL = [
  { id: 'couracado', nome: 'Couraçado', tamanho: 3 },
  { id: 'submarino', nome: 'Submarino', tamanho: 2 },
  { id: 'lancha',    nome: 'Lancha',    tamanho: 1 },
] as const

// Composable da Batalha Naval (5×5) — usa o núcleo partilhado.
// Tem fase de POSICIONAMENTO (cada jogador coloca a sua frota) e COMBATE.
export const usePartidaNaval = (partidaId: string, comoId?: Ref<string | null>) => {
  const core = useCorePartida(partidaId, comoId)
  const { supabase, estado, controlo1, controlo2, jogador1, jogador2, carregar } = core

  const fase = computed<'POSICIONAR' | 'COMBATE'>(() =>
    estado.value.fase === 'COMBATE' ? 'COMBATE' : 'POSICIONAR'
  )
  const vez = computed<1 | 2>(() => (estado.value.vez === 2 ? 2 : 1))

  const souSlot = computed<1 | 2 | null>(() =>
    controlo1.value ? 1 : controlo2.value ? 2 : null
  )
  const oppSlot = computed<1 | 2 | null>(() =>
    souSlot.value === 1 ? 2 : souSlot.value === 2 ? 1 : null
  )

  const prontoEu = computed(() =>
    souSlot.value === 1 ? !!estado.value.pronto_1
    : souSlot.value === 2 ? !!estado.value.pronto_2 : false
  )
  const prontoOponente = computed(() =>
    oppSlot.value === 1 ? !!estado.value.pronto_1
    : oppSlot.value === 2 ? !!estado.value.pronto_2 : false
  )

  const grelha1 = computed<CasaNaval[]>(() =>
    Array.isArray(estado.value.grelha_1) ? estado.value.grelha_1 : Array(25).fill(null)
  )
  const grelha2 = computed<CasaNaval[]>(() =>
    Array.isArray(estado.value.grelha_2) ? estado.value.grelha_2 : Array(25).fill(null)
  )

  // Tiros que EU recebi (minha grelha) = grelha_<souSlot>
  const minhaGrelha = computed<CasaNaval[]>(() =>
    souSlot.value === 2 ? grelha2.value : grelha1.value
  )
  // Tiros que EU dei (grelha do oponente) = grelha_<oppSlot>
  const grelhaInimiga = computed<CasaNaval[]>(() =>
    oppSlot.value === 2 ? grelha2.value : oppSlot.value === 1 ? grelha1.value : Array(25).fill(null)
  )

  const restantes1 = computed(() => estado.value.restantes_1 ?? 0)
  const restantes2 = computed(() => estado.value.restantes_2 ?? 0)
  const meusRestantes = computed(() => (souSlot.value === 2 ? restantes2.value : restantes1.value))
  const inimigoRestantes = computed(() =>
    oppSlot.value === 2 ? restantes2.value : oppSlot.value === 1 ? restantes1.value : 0
  )

  const minhaVez = computed(() =>
    (vez.value === 1 && controlo1.value) || (vez.value === 2 && controlo2.value)
  )
  const jogadorDaVez = computed(() => (vez.value === 1 ? jogador1.value : jogador2.value))
  const idDaJogada = computed(() => {
    if (vez.value === 1 && controlo1.value) return jogador1.value?.id ?? null
    if (vez.value === 2 && controlo2.value) return jogador2.value?.id ?? null
    return null
  })
  const ultimo = computed(() => estado.value.ultimo ?? null)

  // ---- Navios próprios (via RPC) ----
  const meusNavios = ref<number[]>([])
  const meuPlayerId = computed<string | null>(() =>
    souSlot.value === 1 ? jogador1.value?.id ?? null
    : souSlot.value === 2 ? jogador2.value?.id ?? null
    : null
  )

  const carregarNavios = async () => {
    const pid = meuPlayerId.value
    if (!pid) { meusNavios.value = []; return }
    try {
      const { data } = await supabase.rpc('obter_navios', {
        p_partida_id: partidaId, p_jogador_id: pid,
      } as any)
      const arr = (data as number[][] | null) ?? []
      meusNavios.value = arr.flat()
    } catch { /* sem permissão / ainda não posicionado → ignora */ }
  }
  watch(meuPlayerId, (pid) => { if (pid) carregarNavios() })
  if (import.meta.client) onMounted(carregarNavios)

  const meuNavioEm = (pos: number) => meusNavios.value.includes(pos)

  // Frotas reveladas no fim
  const naviosRevelados1 = computed<number[]>(() => (estado.value.navios_1 ?? []).flat?.() ?? [])
  const naviosRevelados2 = computed<number[]>(() => (estado.value.navios_2 ?? []).flat?.() ?? [])

  // ---- Posicionar a frota ----
  const submeterPosicao = async (navios: number[][]) => {
    const { error } = await supabase.rpc('posicionar_navios', {
      p_partida_id: partidaId,
      p_navios: navios,
      p_jogador_id: meuPlayerId.value,
    } as any)
    if (error) throw new Error(error.message)
    await carregar()
    await carregarNavios()
  }

  // ---- Disparar ----
  const disparar = async (pos: number, jogadorId?: string) => {
    const { error } = await supabase.rpc('jogar_naval', {
      p_partida_id: partidaId, p_pos: pos, p_jogador_id: jogadorId ?? null,
    } as any)
    if (error) throw new Error(error.message)
    await carregar()
  }

  return {
    ...core,
    fase, vez, souSlot, oppSlot,
    prontoEu, prontoOponente,
    minhaGrelha, grelhaInimiga,
    meusRestantes, inimigoRestantes,
    minhaVez, jogadorDaVez, idDaJogada, ultimo,
    meusNavios, meuNavioEm, meuPlayerId,
    naviosRevelados1, naviosRevelados2,
    submeterPosicao, disparar,
  }
}
