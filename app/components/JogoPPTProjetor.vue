<script setup lang="ts">
import confetti from 'canvas-confetti'
import type { Partida } from '~/composables/useLobby'
import type { Utilizador } from '~/types/torneio'

const props = defineProps<{
  partida: Partida
  jogador1: Utilizador | null
  jogador2: Utilizador | null
}>()

const dest = computed(() => props.partida)
const estadoD = computed<any>(() => dest.value?.estado ?? {})
const j1 = computed(() => props.jogador1)
const j2 = computed(() => props.jogador2)
const pontos1 = computed(() => estadoD.value.pontos_j1 ?? 0)
const pontos2 = computed(() => estadoD.value.pontos_j2 ?? 0)
const subRonda = computed(() => estadoD.value.sub_ronda ?? 1)
const j1Jogou = computed(() => !!estadoD.value.escolha_j1)
const j2Jogou = computed(() => !!estadoD.value.escolha_j2)
const destTerminada = computed(() => dest.value?.status === 'TERMINADO')
const destVencedor  = computed(() =>
  dest.value?.vencedor_id === j1.value?.id ? j1.value : j2.value
)

const agora = useAgora()
const revelando = computed(() => {
  const r = dest.value?.revelar_ate
  return r ? new Date(r).getTime() > agora.value : false
})
const vitoriaVisivel = computed(() => destTerminada.value && !revelando.value)

const escolhasMap: Record<string, string> = { pedra: '✊', papel: '✋', tesoura: '✌️' }
const emoji = (v: string | null | undefined) => (v ? escolhasMap[v] : '❔')

const ultima = computed(() => {
  const h = estadoD.value.historico ?? []
  return h.length ? h[h.length - 1] : null
})
const resultadoUltima = computed(() => {
  const u = ultima.value
  if (!u) return null
  if (!u.vencedor) return { texto: 'Empate', cor: 'warning' }
  const nome = u.vencedor === j1.value?.id ? j1.value?.name : j2.value?.name
  return { texto: `${nome} ganha a ronda`, cor: 'success' }
})

const inicial = (u: Utilizador | null) => u?.name?.charAt(0).toUpperCase() ?? '?'

watch(vitoriaVisivel, (vis, antes) => {
  if (vis && !antes) confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } })
})
</script>

<template>
  <div class="palco">
    <div class="arena mb-8">
      <div class="text-center jogador" :class="{ 'jogador--lose': vitoriaVisivel && dest.vencedor_id !== j1?.id }">
        <v-avatar size="180" class="ring-blue mb-3">
          <v-img v-if="j1?.avatar_url" :src="j1.avatar_url" cover />
          <span v-else class="text-blue font-weight-black" style="font-size:4rem">{{ inicial(j1) }}</span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ j1?.name }}</h2>
        <div class="mt-2">
          <v-chip v-if="!vitoriaVisivel && !revelando && j1Jogou" color="success" size="small"><v-icon start size="14">mdi-check</v-icon>Já jogou</v-chip>
          <v-chip v-else-if="!vitoriaVisivel && !revelando" color="surface-variant" size="small">A pensar…</v-chip>
        </div>
      </div>

      <div class="text-center">
        <div class="placar">
          <span class="text-blue">{{ pontos1 }}</span>
          <span class="text-medium-emphasis mx-3">:</span>
          <span class="text-red">{{ pontos2 }}</span>
        </div>
        <v-chip v-if="!vitoriaVisivel" size="small" variant="tonal">Ronda {{ subRonda }} · à melhor de 3</v-chip>
        <v-chip v-else color="accent" size="large" class="font-weight-bold"><v-icon start>mdi-trophy</v-icon>{{ destVencedor?.name }} vence!</v-chip>
      </div>

      <div class="text-center jogador" :class="{ 'jogador--lose': vitoriaVisivel && dest.vencedor_id !== j2?.id }">
        <v-avatar size="180" class="ring-red mb-3">
          <v-img v-if="j2?.avatar_url" :src="j2.avatar_url" cover />
          <span v-else class="text-red font-weight-black" style="font-size:4rem">{{ inicial(j2) }}</span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ j2?.name }}</h2>
        <div class="mt-2">
          <v-chip v-if="!vitoriaVisivel && !revelando && j2Jogou" color="success" size="small"><v-icon start size="14">mdi-check</v-icon>Já jogou</v-chip>
          <v-chip v-else-if="!vitoriaVisivel && !revelando" color="surface-variant" size="small">A pensar…</v-chip>
        </div>
      </div>
    </div>

    <v-expand-transition>
      <div v-if="resultadoUltima && revelando" class="text-center reveal">
        <div class="d-flex align-center justify-center gap-10">
          <div class="emoji text-blue">{{ emoji(ultima.e1) }}</div>
          <span class="text-h5 text-medium-emphasis">vs</span>
          <div class="emoji text-red">{{ emoji(ultima.e2) }}</div>
        </div>
        <v-chip :color="resultadoUltima.cor" size="large" class="mt-4 font-weight-bold">{{ resultadoUltima.texto }}</v-chip>
      </div>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.palco { padding-top: 2vh; }
.arena {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(48px, 9vw, 140px);
}
.jogador { width: clamp(180px, 18vw, 260px); transition: opacity 0.4s; }
.jogador--lose { opacity: 0.35; }

.placar {
  font-size: clamp(4rem, 7vw, 7rem);
  font-weight: 900;
  line-height: 1;
  padding: 0 12px;
  white-space: nowrap;
}

.reveal { margin-top: 2vh; }
.emoji { font-size: 7rem; line-height: 1; }

.ring-blue { outline: 4px solid #00B0FF; outline-offset: 4px; background: rgba(0,176,255,0.15); box-shadow: 0 0 40px rgba(0,176,255,0.5); }
.ring-red  { outline: 4px solid #FF1744; outline-offset: 4px; background: rgba(255,23,68,0.15); box-shadow: 0 0 40px rgba(255,23,68,0.5); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
</style>
