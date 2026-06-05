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

const fase = computed<'POSICIONAR' | 'COMBATE'>(() => e.value.fase === 'COMBATE' ? 'COMBATE' : 'POSICIONAR')
const pronto1 = computed(() => !!e.value.pronto_1)
const pronto2 = computed(() => !!e.value.pronto_2)

const grelha1 = computed<any[]>(() => Array.isArray(e.value.grelha_1) ? e.value.grelha_1 : Array(25).fill(null))
const grelha2 = computed<any[]>(() => Array.isArray(e.value.grelha_2) ? e.value.grelha_2 : Array(25).fill(null))
const restantes1 = computed(() => e.value.restantes_1 ?? 7)
const restantes2 = computed(() => e.value.restantes_2 ?? 7)
const vez = computed<1 | 2>(() => (e.value.vez === 2 ? 2 : 1))
const ultimo = computed(() => e.value.ultimo ?? null)

const navios1 = computed<number[]>(() => (e.value.navios_1 ?? []).flat?.() ?? [])
const navios2 = computed<number[]>(() => (e.value.navios_2 ?? []).flat?.() ?? [])

const destTerminada = computed(() => dest.value?.status === 'TERMINADO')
const destVencedor = computed(() => dest.value?.vencedor_id === j1.value?.id ? j1.value : j2.value)

const agora = useAgora()
const revelando = computed(() => {
  const r = dest.value?.revelar_ate
  return r ? new Date(r).getTime() > agora.value : false
})
const vitoriaVisivel = computed(() => destTerminada.value && !revelando.value)

const inicial = (u: Utilizador | null) => u?.name?.charAt(0).toUpperCase() ?? '?'

// Casa do último disparo (no tabuleiro de quem o recebeu)
const ultimoAlvoSlot = computed(() => ultimo.value ? (ultimo.value.por === 1 ? 2 : 1) : null)
const ehUltimo = (slot: 1 | 2, pos: number) =>
  !!ultimo.value && ultimoAlvoSlot.value === slot && ultimo.value.pos === pos && !vitoriaVisivel.value

function lançarConfetti() {
  confetti({ particleCount: 200, spread: 100, origin: { x: 0.5, y: 0.55 }, zIndex: 9999 })
  confetti({ particleCount: 120, angle: 60,  spread: 70, origin: { x: 0, y: 0.6 }, zIndex: 9999 })
  confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, zIndex: 9999 })
  setTimeout(() => {
    confetti({ particleCount: 150, spread: 120, origin: { x: 0.5, y: 0.4 }, zIndex: 9999 })
    confetti({ particleCount: 80,  angle: 70,  spread: 60, origin: { x: 0.1, y: 0.5 }, zIndex: 9999 })
    confetti({ particleCount: 80,  angle: 110, spread: 60, origin: { x: 0.9, y: 0.5 }, zIndex: 9999 })
  }, 600)
  setTimeout(() => {
    confetti({ particleCount: 100, spread: 160, origin: { x: 0.5, y: 0 }, gravity: 0.6, zIndex: 9999 })
  }, 1400)
}

// Dispara logo que o servidor apura o vencedor (início da revelação),
// igual ao ecrã do jogador — não espera pelo fim da revelação.
watch(destTerminada, (v, old) => {
  if (v && !old) lançarConfetti()
})

onMounted(() => { if (destTerminada.value) lançarConfetti() })

const textoUltimo = computed(() => {
  const u = ultimo.value
  if (!u || vitoriaVisivel.value) return null
  if (u.resultado === 'afundou') return 'Navio afundado! 💥'
  if (u.resultado === 'acerto') return 'Acerto! 🔥'
  return 'Água… 🌊'
})
</script>

<template>
  <div class="palco">
    <!-- ===== FASE: POSICIONAR ===== -->
    <div v-if="fase === 'POSICIONAR' && !vitoriaVisivel" class="posicionar">
      <v-icon size="80" color="primary" class="mb-4">mdi-map-marker-radius</v-icon>
      <h2 class="text-h3 font-weight-black mb-2">Os capitães estão a posicionar a frota…</h2>
      <p class="text-h6 text-medium-emphasis mb-8">Couraçado · Submarino · Lancha</p>
      <div class="d-flex justify-center gap-10">
        <div class="text-center">
          <v-avatar size="120" class="ring-blue mb-3">
            <v-img v-if="j1?.avatar_url" :src="j1.avatar_url" cover />
            <span v-else class="text-blue font-weight-black" style="font-size:2.6rem">{{ inicial(j1) }}</span>
          </v-avatar>
          <div class="text-h5 font-weight-black mb-2">{{ j1?.name }}</div>
          <v-chip :color="pronto1 ? 'success' : 'surface-variant'" size="large" :variant="pronto1 ? 'flat' : 'tonal'">
            <v-icon start>{{ pronto1 ? 'mdi-check-circle' : 'mdi-timer-sand' }}</v-icon>
            {{ pronto1 ? 'Pronto!' : 'A posicionar…' }}
          </v-chip>
        </div>
        <div class="text-center">
          <v-avatar size="120" class="ring-red mb-3">
            <v-img v-if="j2?.avatar_url" :src="j2.avatar_url" cover />
            <span v-else class="text-red font-weight-black" style="font-size:2.6rem">{{ inicial(j2) }}</span>
          </v-avatar>
          <div class="text-h5 font-weight-black mb-2">{{ j2?.name }}</div>
          <v-chip :color="pronto2 ? 'success' : 'surface-variant'" size="large" :variant="pronto2 ? 'flat' : 'tonal'">
            <v-icon start>{{ pronto2 ? 'mdi-check-circle' : 'mdi-timer-sand' }}</v-icon>
            {{ pronto2 ? 'Pronto!' : 'A posicionar…' }}
          </v-chip>
        </div>
      </div>
    </div>

    <!-- ===== FASE: COMBATE ===== -->
    <template v-else>
    <!-- Indicador de vez / resultado -->
    <div class="text-center mb-5">
      <v-chip v-if="vitoriaVisivel" color="accent" size="x-large" class="font-weight-bold">
        <v-icon start>mdi-trophy</v-icon>{{ destVencedor?.name }} vence!
      </v-chip>
      <template v-else>
        <v-chip size="large" variant="tonal" :color="vez === 1 ? 'primary' : 'secondary'" class="font-weight-bold">
          <v-icon start>mdi-crosshairs-gps</v-icon>
          Vez de {{ vez === 1 ? j1?.name : j2?.name }}
        </v-chip>
        <div v-if="textoUltimo" class="text-h6 font-weight-bold mt-2"
             :class="ultimo?.resultado === 'agua' ? 'text-medium-emphasis' : 'text-accent'">
          {{ textoUltimo }}
        </div>
      </template>
    </div>

    <div class="arena">
      <!-- Frota do Jogador 1 -->
      <div class="lado" :class="{ 'lado--lose': vitoriaVisivel && dest.vencedor_id !== j1?.id }">
        <div class="cabeca">
          <v-avatar size="84" class="ring-blue" :class="{ 'glow-on': vez === 1 && !destTerminada }">
            <v-img v-if="j1?.avatar_url" :src="j1.avatar_url" cover />
            <span v-else class="text-blue font-weight-black" style="font-size:2rem">{{ inicial(j1) }}</span>
          </v-avatar>
          <div>
            <div class="text-h5 font-weight-black">{{ j1?.name }}</div>
            <div class="text-caption text-medium-emphasis">
              <v-icon size="14">mdi-ferry</v-icon> {{ restantes1 }} casas intactas
            </div>
          </div>
        </div>
        <div class="grelha">
          <div
            v-for="i in 25" :key="'g1-' + (i - 1)"
            class="casa"
            :class="{
              'casa--acerto': grelha1[i - 1] === 'acerto',
              'casa--agua': grelha1[i - 1] === 'agua',
              'casa--navio': navios1.includes(i - 1) && grelha1[i - 1] !== 'acerto',
              'casa--ultimo': ehUltimo(1, i - 1),
            }"
          >
            <v-icon v-if="grelha1[i - 1] === 'acerto'" color="deep-orange" size="30">mdi-fire</v-icon>
            <v-icon v-else-if="navios1.includes(i - 1)" color="#40C4FF" size="26">mdi-ferry</v-icon>
            <v-icon v-else-if="grelha1[i - 1] === 'agua'" color="blue" size="18">mdi-circle-outline</v-icon>
          </div>
        </div>
      </div>

      <div class="vs">VS</div>

      <!-- Frota do Jogador 2 -->
      <div class="lado" :class="{ 'lado--lose': vitoriaVisivel && dest.vencedor_id !== j2?.id }">
        <div class="cabeca">
          <v-avatar size="84" class="ring-red" :class="{ 'glow-on': vez === 2 && !destTerminada }">
            <v-img v-if="j2?.avatar_url" :src="j2.avatar_url" cover />
            <span v-else class="text-red font-weight-black" style="font-size:2rem">{{ inicial(j2) }}</span>
          </v-avatar>
          <div>
            <div class="text-h5 font-weight-black">{{ j2?.name }}</div>
            <div class="text-caption text-medium-emphasis">
              <v-icon size="14">mdi-ferry</v-icon> {{ restantes2 }} casas intactas
            </div>
          </div>
        </div>
        <div class="grelha">
          <div
            v-for="i in 25" :key="'g2-' + (i - 1)"
            class="casa"
            :class="{
              'casa--acerto': grelha2[i - 1] === 'acerto',
              'casa--agua': grelha2[i - 1] === 'agua',
              'casa--navio-red': navios2.includes(i - 1) && grelha2[i - 1] !== 'acerto',
              'casa--ultimo': ehUltimo(2, i - 1),
            }"
          >
            <v-icon v-if="grelha2[i - 1] === 'acerto'" color="deep-orange" size="30">mdi-fire</v-icon>
            <v-icon v-else-if="navios2.includes(i - 1)" color="#FF5252" size="26">mdi-ferry</v-icon>
            <v-icon v-else-if="grelha2[i - 1] === 'agua'" color="blue" size="18">mdi-circle-outline</v-icon>
          </div>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.palco { padding-top: 1vh; }
.posicionar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: calc(100vh - 240px);
}
.arena {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(24px, 4vw, 72px);
}
.lado { transition: opacity 0.4s; }
.lado--lose { opacity: 0.4; }

.cabeca {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 16px; justify-content: center;
}

.grelha {
  display: grid;
  grid-template-columns: repeat(5, clamp(64px, 6.5vw, 92px));
  grid-template-rows: repeat(5, clamp(64px, 6.5vw, 92px));
  gap: 8px;
  padding: 12px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(0,60,110,0.3), rgba(0,30,70,0.4));
  border: 1px solid rgba(0,176,255,0.28);
}
.casa {
  border-radius: 12px;
  background: rgba(13,13,26,0.55);
  border: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
  transition: box-shadow 0.3s, border-color 0.3s;
}
.casa--acerto { background: rgba(255,87,34,0.2); border-color: rgba(255,87,34,0.55); }
.casa--agua { background: rgba(0,176,255,0.08); }
.casa--navio { background: rgba(0,176,255,0.12); border-color: rgba(0,176,255,0.4); }
.casa--navio-red { background: rgba(255,23,68,0.12); border-color: rgba(255,23,68,0.4); }
.casa--ultimo {
  box-shadow: 0 0 22px rgba(255,214,0,0.85);
  border-color: rgb(var(--v-theme-accent));
  animation: winPulse 1s ease-in-out infinite;
}
@keyframes winPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }

.vs {
  font-size: clamp(1.6rem, 3vw, 2.6rem);
  font-weight: 900;
  color: rgba(255,255,255,0.45);
  flex-shrink: 0;
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
.text-accent { color: rgb(var(--v-theme-accent)); }
</style>
