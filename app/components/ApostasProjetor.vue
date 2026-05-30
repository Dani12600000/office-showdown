<script setup lang="ts">
import type { Utilizador } from '~/types/torneio'

const props = defineProps<{
  j1: Utilizador | null
  j2: Utilizador | null
  pote1: number
  pote2: number
  n1: number
  n2: number
}>()

const total = computed(() => props.pote1 + props.pote2)
const pct1 = computed(() => total.value ? Math.round((props.pote1 / total.value) * 100) : 50)
const pct2 = computed(() => 100 - pct1.value)
const inicial = (u: Utilizador | null) => u?.name?.charAt(0).toUpperCase() ?? '?'
</script>

<template>
  <div class="apostas">
    <v-chip color="accent" size="x-large" class="font-weight-black mb-2 pulse-chip">
      <v-icon start>mdi-cash-multiple</v-icon>APOSTAS ABERTAS
    </v-chip>
    <p class="text-h6 text-medium-emphasis mb-8">
      <v-icon color="primary">mdi-cellphone</v-icon> Aposta no telemóvel em quem vai ganhar!
    </p>

    <div class="arena mb-8">
      <div class="text-center lado">
        <v-avatar size="170" class="ring-blue mb-3">
          <v-img v-if="j1?.avatar_url" :src="j1.avatar_url" cover />
          <span v-else class="text-blue font-weight-black" style="font-size:3.6rem">{{ inicial(j1) }}</span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ j1?.name }}</h2>
        <div class="text-h5 font-weight-black text-blue mt-2">{{ pote1 }} 🪙</div>
        <div class="text-body-1 text-medium-emphasis">{{ n1 }} apostas</div>
      </div>

      <div class="vs">VS</div>

      <div class="text-center lado">
        <v-avatar size="170" class="ring-red mb-3">
          <v-img v-if="j2?.avatar_url" :src="j2.avatar_url" cover />
          <span v-else class="text-red font-weight-black" style="font-size:3.6rem">{{ inicial(j2) }}</span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ j2?.name }}</h2>
        <div class="text-h5 font-weight-black text-red mt-2">{{ pote2 }} 🪙</div>
        <div class="text-body-1 text-medium-emphasis">{{ n2 }} apostas</div>
      </div>
    </div>

    <!-- Barra do pote -->
    <div class="pote-bar mx-auto">
      <div class="pote-lado pote-blue" :style="{ width: pct1 + '%' }"><span v-if="pct1 > 8">{{ pct1 }}%</span></div>
      <div class="pote-lado pote-red" :style="{ width: pct2 + '%' }"><span v-if="pct2 > 8">{{ pct2 }}%</span></div>
    </div>
    <p class="text-h6 font-weight-bold mt-3">Pote total: {{ total }} 🪙</p>
  </div>
</template>

<style scoped>
.apostas { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 2vh; }
.arena { display: flex; align-items: center; justify-content: center; gap: clamp(40px, 8vw, 140px); }
.lado { width: clamp(180px, 18vw, 260px); }
.vs { font-size: clamp(2rem, 4vw, 3.4rem); font-weight: 900; color: rgba(255,255,255,0.45); }

.pote-bar {
  display: flex; height: 44px; width: min(70vw, 900px);
  border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.06);
}
.pote-lado { display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 900; transition: width 0.5s ease; min-width: 0; }
.pote-blue { background: linear-gradient(90deg, rgba(0,176,255,0.5), rgba(0,176,255,0.85)); color: #001018; }
.pote-red  { background: linear-gradient(90deg, rgba(255,23,68,0.85), rgba(255,23,68,0.5)); color: #1a0006; }

.pulse-chip { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }

.ring-blue { outline: 4px solid #00B0FF; outline-offset: 4px; background: rgba(0,176,255,0.15); box-shadow: 0 0 40px rgba(0,176,255,0.5); }
.ring-red  { outline: 4px solid #FF1744; outline-offset: 4px; background: rgba(255,23,68,0.15); box-shadow: 0 0 40px rgba(255,23,68,0.5); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
</style>
