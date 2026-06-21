<script setup lang="ts">
import type { Utilizador } from '~/types/torneio'

// Apresentação dos lutadores quando a partida é posta em destaque.
// Leva ao ecrã de APOSTAS — por isso NÃO tem contagem nem "LUTAR!"
// (isso passou para a ContagemInicio, no arranque real do jogo).
const props = defineProps<{
  jogador1: Utilizador | null
  jogador2: Utilizador | null
  visivel: boolean
}>()

const emit = defineEmits<{ done: [] }>()

const jogadoresVisiveis = ref(false)
const vsVisivel         = ref(false)
const aFadeOut          = ref(false)

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

watch(() => props.visivel, async (v) => {
  if (!v) return

  jogadoresVisiveis.value = false
  vsVisivel.value         = false
  aFadeOut.value          = false

  await delay(120)
  jogadoresVisiveis.value = true

  await delay(900)
  vsVisivel.value = true

  await delay(1400)
  aFadeOut.value = true
  await delay(450)
  emit('done')
}, { immediate: false })
</script>

<template>
  <Teleport to="body">
    <Transition name="intro-overlay">
      <div v-if="visivel" class="intro-overlay" :class="{ 'fade-out': aFadeOut }">

        <!-- Fundo com grid néon -->
        <div class="intro-grid" />

        <!-- Jogadores -->
        <div class="intro-jogadores" :class="{ visible: jogadoresVisiveis }">

          <!-- Jogador 1 — esquerda, azul -->
          <div class="intro-player intro-player--blue">
            <div class="intro-player-glow intro-player-glow--blue" />
            <v-avatar size="140" class="intro-avatar intro-ring--blue mb-4">
              <v-img v-if="jogador1?.avatar_url" :src="jogador1.avatar_url" cover />
              <span v-else class="text-h2 font-weight-black" style="color:#40C4FF">
                {{ jogador1?.name?.charAt(0).toUpperCase() }}
              </span>
            </v-avatar>
            <div class="intro-player-label" style="color:#40C4FF">JOGADOR 1</div>
            <div class="intro-player-name">{{ jogador1?.name }}</div>
          </div>

          <!-- VS central -->
          <div class="intro-vs" :class="{ visible: vsVisivel }">
            <span class="intro-vs-text">VS</span>
          </div>

          <!-- Jogador 2 — direita, vermelho -->
          <div class="intro-player intro-player--red">
            <div class="intro-player-glow intro-player-glow--red" />
            <v-avatar size="140" class="intro-avatar intro-ring--red mb-4">
              <v-img v-if="jogador2?.avatar_url" :src="jogador2.avatar_url" cover />
              <span v-else class="text-h2 font-weight-black" style="color:#FF5252">
                {{ jogador2?.name?.charAt(0).toUpperCase() }}
              </span>
            </v-avatar>
            <div class="intro-player-label" style="color:#FF5252">JOGADOR 2</div>
            <div class="intro-player-name">{{ jogador2?.name }}</div>
          </div>

        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────── */
.intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #050810;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: opacity 0.4s ease;
}
.intro-overlay.fade-out { opacity: 0; }

/* ── Grid néon de fundo ──────────────────────────────────── */
.intro-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 60%, transparent 100%);
}

/* ── Jogadores ───────────────────────────────────────────── */
.intro-jogadores {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
  padding: 0 24px;
}

.intro-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease;
  opacity: 0;
}
.intro-player--blue { transform: translateX(-120px); }
.intro-player--red  { transform: translateX(120px); }
.intro-jogadores.visible .intro-player {
  opacity: 1;
  transform: translateX(0);
}

.intro-player-glow {
  position: absolute;
  inset: -40px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
  pointer-events: none;
  z-index: -1;
}
.intro-player-glow--blue { background: #00B0FF; }
.intro-player-glow--red  { background: #FF1744; }

.intro-avatar { flex-shrink: 0; }
.intro-ring--blue {
  outline: 3px solid #00B0FF;
  outline-offset: 4px;
  box-shadow: 0 0 32px rgba(0,176,255,0.6), 0 0 64px rgba(0,176,255,0.3);
}
.intro-ring--red {
  outline: 3px solid #FF1744;
  outline-offset: 4px;
  box-shadow: 0 0 32px rgba(255,23,68,0.6), 0 0 64px rgba(255,23,68,0.3);
}

.intro-player-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  opacity: 0.8;
}
.intro-player-name {
  font-size: 22px;
  font-weight: 900;
  color: #fff;
  text-align: center;
  text-shadow: 0 2px 16px rgba(0,0,0,0.8);
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── VS central ──────────────────────────────────────────── */
.intro-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  opacity: 0;
  transform: scale(0.4);
}
.intro-vs.visible {
  opacity: 1;
  transform: scale(1);
}

.intro-vs-text {
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 900;
  color: #FFEA00;
  text-shadow:
    0 0 20px #FFEA00,
    0 0 40px rgba(255,234,0,0.5);
  letter-spacing: 4px;
  animation: vs-pulse 1.2s ease-in-out infinite alternate;
}
@keyframes vs-pulse {
  from { text-shadow: 0 0 20px #FFEA00, 0 0 40px rgba(255,234,0,0.5); }
  to   { text-shadow: 0 0 36px #FFEA00, 0 0 72px rgba(255,234,0,0.8); }
}

/* ── Transição do overlay inteiro ───────────────────────── */
.intro-overlay-enter-active { animation: overlay-in 0.3s ease; }
.intro-overlay-leave-active { animation: overlay-out 0.3s ease; }
@keyframes overlay-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes overlay-out { from { opacity: 1; } to { opacity: 0; } }

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 600px) {
  .intro-player-name { font-size: 16px; max-width: 110px; }
  .intro-avatar { width: 96px !important; height: 96px !important; }
  .intro-vs-text { font-size: 32px; }
}
</style>
