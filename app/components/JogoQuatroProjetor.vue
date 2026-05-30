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
const e = computed<any>(() => dest.value?.estado ?? {})
const j1 = computed(() => props.jogador1)
const j2 = computed(() => props.jogador2)

const tabuleiro = computed<(1 | 2 | null)[]>(() => {
  const t = e.value.tabuleiro
  return Array.isArray(t) && t.length === 42 ? t : Array(42).fill(null)
})
const vez = computed<1 | 2>(() => (e.value.vez === 2 ? 2 : 1))
const linha = computed<number[] | null>(() => e.value.linha_vencedora ?? null)
const empates = computed<number>(() => e.value.empates ?? 0)

const destTerminada = computed(() => dest.value?.status === 'TERMINADO')
const destVencedor = computed(() =>
  dest.value?.vencedor_id === j1.value?.id ? j1.value : j2.value
)

const agora = useAgora()
const revelando = computed(() => {
  const r = dest.value?.revelar_ate
  return r ? new Date(r).getTime() > agora.value : false
})
const vitoriaVisivel = computed(() => destTerminada.value && !revelando.value)

const idx = (row: number, col: number) => row * 7 + col
const peca = (row: number, col: number) => tabuleiro.value[idx(row, col)]
const corDe = (n: 1 | 2 | null) => n === 1 ? 'blue' : n === 2 ? 'red' : null
const jogadorDe = (n: 1 | 2 | null) => n === 1 ? j1.value : n === 2 ? j2.value : null
const ehVencedora = (row: number, col: number) => !!linha.value?.includes(idx(row, col))
const inicial = (u: Utilizador | null) => u?.name?.charAt(0).toUpperCase() ?? '?'
const jogadorDaVez = computed(() => vez.value === 1 ? j1.value : j2.value)

watch(vitoriaVisivel, (vis, antes) => {
  if (vis && !antes) confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } })
})
</script>

<template>
  <div class="palco">
    <div class="arena">
      <!-- Jogador 1 -->
      <div class="text-center jogador-side" :class="{ 'side--lose': vitoriaVisivel && dest.vencedor_id !== j1?.id }">
        <v-avatar size="150" class="ring-blue mb-3" :class="{ 'glow-on': vez === 1 && !destTerminada }">
          <v-img v-if="j1?.avatar_url" :src="j1.avatar_url" cover />
          <span v-else class="text-blue font-weight-black" style="font-size:3.2rem">{{ inicial(j1) }}</span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ j1?.name }}</h2>
        <v-chip v-if="!destTerminada && vez === 1" color="primary" size="small" variant="flat" class="mt-2 font-weight-bold">
          <v-icon start size="14">mdi-arrow-right-bold</v-icon>A jogar
        </v-chip>
      </div>

      <!-- Tabuleiro -->
      <div class="text-center">
        <div class="tabuleiro">
          <div v-for="c in 7" :key="c - 1" class="coluna">
            <div
              v-for="r in 6" :key="r - 1"
              class="casa"
              :class="[peca(r - 1, c - 1) ? `casa--${corDe(peca(r - 1, c - 1))}` : '', { 'casa--win': ehVencedora(r - 1, c - 1) }]"
            >
              <!-- Peça = avatar redondo com moldura néon, dimensionado por CSS
                   para escalar com a casa em qualquer tamanho de ecrã. -->
              <div
                v-if="peca(r - 1, c - 1)"
                class="peca"
                :class="`peca--${corDe(peca(r - 1, c - 1))}`"
                :style="jogadorDe(peca(r - 1, c - 1))?.avatar_url
                  ? { backgroundImage: `url(${jogadorDe(peca(r - 1, c - 1))!.avatar_url})` }
                  : {}"
              >
                <span v-if="!jogadorDe(peca(r - 1, c - 1))?.avatar_url" :class="`text-${corDe(peca(r - 1, c - 1))}`">
                  {{ jogadorDe(peca(r - 1, c - 1))?.name?.charAt(0).toUpperCase() }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-4">
          <v-chip v-if="vitoriaVisivel" color="accent" size="large" class="font-weight-bold">
            <v-icon start>mdi-trophy</v-icon>{{ destVencedor?.name }} vence!
          </v-chip>
          <v-chip v-else-if="revelando && empates > 0" color="warning" size="large" class="font-weight-bold">
            Empate! Recomeça…
          </v-chip>
          <v-chip v-else size="large" variant="tonal">
            Vez de <strong class="ml-1">{{ jogadorDaVez?.name }}</strong>
          </v-chip>
          <div v-if="empates > 0 && !vitoriaVisivel" class="text-caption text-medium-emphasis mt-2">
            {{ empates }} empate{{ empates > 1 ? 's' : '' }} até agora
          </div>
        </div>
      </div>

      <!-- Jogador 2 -->
      <div class="text-center jogador-side" :class="{ 'side--lose': vitoriaVisivel && dest.vencedor_id !== j2?.id }">
        <v-avatar size="150" class="ring-red mb-3" :class="{ 'glow-on': vez === 2 && !destTerminada }">
          <v-img v-if="j2?.avatar_url" :src="j2.avatar_url" cover />
          <span v-else class="text-red font-weight-black" style="font-size:3.2rem">{{ inicial(j2) }}</span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ j2?.name }}</h2>
        <v-chip v-if="!destTerminada && vez === 2" color="secondary" size="small" variant="flat" class="mt-2 font-weight-bold">
          <v-icon start size="14">mdi-arrow-right-bold</v-icon>A jogar
        </v-chip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palco { padding-top: 1vh; }
.arena {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(28px, 4vw, 80px);
}
.jogador-side { width: clamp(160px, 14vw, 220px); transition: opacity 0.4s; }
.side--lose { opacity: 0.35; }

.tabuleiro {
  display: flex;
  gap: 10px;
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(0,80,140,0.3), rgba(0,40,90,0.4));
  border: 1px solid rgba(0,176,255,0.3);
}
.coluna { display: flex; flex-direction: column; gap: 10px; }
.casa {
  width: 74px; height: 74px;
  border-radius: 50%;
  background: rgba(13,13,26,0.6);
  border: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
  transition: box-shadow 0.3s, border-color 0.3s;
}

/* Peça preenche ~84% da casa e escala com ela */
.peca {
  width: 84%; height: 84%;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900;
  font-size: 1.5rem;
}
.peca--blue {
  outline: 4px solid #00B0FF; outline-offset: -1px;
  background-color: rgba(0,176,255,0.15);
  box-shadow: 0 0 22px rgba(0,176,255,0.5);
}
.peca--red {
  outline: 4px solid #FF1744; outline-offset: -1px;
  background-color: rgba(255,23,68,0.15);
  box-shadow: 0 0 22px rgba(255,23,68,0.5);
}
.casa--win {
  box-shadow: 0 0 26px rgba(255, 214, 0, 0.85);
  border-color: rgb(var(--v-theme-accent));
  animation: winPulse 1.2s ease-in-out infinite;
}
@keyframes winPulse {
  0%,100% { transform: scale(1); }
  50%     { transform: scale(1.06); }
}

.glow-on { animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse {
  0%,100% { box-shadow: 0 0 24px rgba(255,255,255,0.2); }
  50%     { box-shadow: 0 0 48px rgba(0,229,255,0.7); }
}

.ring-blue { outline: 4px solid #00B0FF; outline-offset: 3px; background: rgba(0,176,255,0.15); box-shadow: 0 0 22px rgba(0,176,255,0.5); }
.ring-red  { outline: 4px solid #FF1744; outline-offset: 3px; background: rgba(255,23,68,0.15); box-shadow: 0 0 22px rgba(255,23,68,0.5); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }

/* Ecrãs mais pequenos: encolhe as casas para caber sem scroll */
@media (max-width: 1400px) {
  .casa { width: 60px; height: 60px; }
}
@media (max-width: 1100px) {
  .casa { width: 48px; height: 48px; }
}
</style>
