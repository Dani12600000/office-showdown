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
  return Array.isArray(t) && t.length === 9 ? t : Array(9).fill(null)
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

const jogadorDe = (n: 1 | 2 | null) => n === 1 ? j1.value : n === 2 ? j2.value : null
const corDe = (n: 1 | 2 | null) => n === 1 ? 'blue' : n === 2 ? 'red' : null
const ehVencedora = (pos: number) => !!linha.value?.includes(pos)
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
        <v-avatar size="160" class="ring-blue mb-3" :class="{ 'glow-on': vez === 1 && !destTerminada }">
          <v-img v-if="j1?.avatar_url" :src="j1.avatar_url" cover />
          <span v-else class="text-blue font-weight-black" style="font-size:3.5rem">{{ inicial(j1) }}</span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ j1?.name }}</h2>
        <v-chip v-if="!destTerminada && vez === 1" color="primary" size="small" variant="flat" class="mt-2 font-weight-bold">
          <v-icon start size="14">mdi-arrow-right-bold</v-icon>A jogar
        </v-chip>
      </div>

      <!-- Tabuleiro -->
      <div class="text-center">
        <div class="tabuleiro">
          <div
            v-for="(c, i) in tabuleiro" :key="i"
            class="casa"
            :class="[
              { 'casa--win': ehVencedora(i) },
              c ? `casa--${corDe(c)}` : ''
            ]"
          >
            <v-avatar v-if="c" size="92" :class="corDe(c) === 'blue' ? 'ring-blue' : 'ring-red'">
              <v-img v-if="jogadorDe(c)?.avatar_url" :src="jogadorDe(c)!.avatar_url!" cover />
              <span v-else class="font-weight-black" :class="`text-${corDe(c)}`" style="font-size:2rem">
                {{ jogadorDe(c)?.name?.charAt(0).toUpperCase() }}
              </span>
            </v-avatar>
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
        <v-avatar size="160" class="ring-red mb-3" :class="{ 'glow-on': vez === 2 && !destTerminada }">
          <v-img v-if="j2?.avatar_url" :src="j2.avatar_url" cover />
          <span v-else class="text-red font-weight-black" style="font-size:3.5rem">{{ inicial(j2) }}</span>
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
.palco { padding-top: 2vh; }
.arena {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(40px, 6vw, 100px);
}
.jogador-side { width: clamp(180px, 16vw, 240px); transition: opacity 0.4s; }
.side--lose { opacity: 0.35; }

.tabuleiro {
  display: grid;
  grid-template-columns: repeat(3, clamp(110px, 11vw, 150px));
  grid-template-rows: repeat(3, clamp(110px, 11vw, 150px));
  gap: 14px;
  padding: 14px;
  border-radius: 22px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
}
.casa {
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  display: flex; align-items: center; justify-content: center;
  transition: box-shadow 0.3s, border-color 0.3s;
}
.casa--blue { border-color: rgba(0,176,255,0.4); background: rgba(0,176,255,0.06); }
.casa--red  { border-color: rgba(255,23,68,0.4); background: rgba(255,23,68,0.06); }
.casa--win  {
  box-shadow: 0 0 32px rgba(255, 214, 0, 0.8);
  border-color: rgb(var(--v-theme-accent));
  animation: winPulse 1.2s ease-in-out infinite;
}
@keyframes winPulse {
  0%,100% { transform: scale(1); }
  50%     { transform: scale(1.05); }
}

.glow-on { animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse {
  0%,100% { box-shadow: 0 0 24px rgba(255,255,255,0.2); }
  50%     { box-shadow: 0 0 48px rgba(0,229,255,0.7); }
}

.ring-blue { outline: 4px solid #00B0FF; outline-offset: 4px; background: rgba(0,176,255,0.15); box-shadow: 0 0 24px rgba(0,176,255,0.5); }
.ring-red  { outline: 4px solid #FF1744; outline-offset: 4px; background: rgba(255,23,68,0.15); box-shadow: 0 0 24px rgba(255,23,68,0.5); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
</style>
