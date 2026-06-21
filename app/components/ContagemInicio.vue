<script setup lang="ts">
// Contagem decrescente 3...2...1 → LUTAR! no ARRANQUE REAL do jogo
// (quando as apostas fecham e o tabuleiro aparece). Emite `lutar` no
// momento do "LUTAR!" para o projetor tocar o som de início (din din din).
const props = defineProps<{ visivel: boolean }>()
const emit = defineEmits<{ done: []; lutar: [] }>()

const contagem = ref<number | null>(null)
const fight    = ref(false)
const aFadeOut = ref(false)

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

watch(() => props.visivel, async (v) => {
  if (!v) return

  contagem.value = null
  fight.value    = false
  aFadeOut.value = false

  await delay(150)
  for (const n of [3, 2, 1]) {
    contagem.value = n
    await delay(800)
  }

  contagem.value = null
  fight.value = true
  emit('lutar')        // ← som de início toca aqui, depois do 3...2...1
  await delay(800)

  aFadeOut.value = true
  await delay(400)
  emit('done')
}, { immediate: false })
</script>

<template>
  <Teleport to="body">
    <Transition name="cont-overlay">
      <div v-if="visivel" class="cont-overlay" :class="{ 'fade-out': aFadeOut }">
        <div class="cont-grid" />

        <!-- Números -->
        <Transition name="count-pop">
          <div v-if="contagem !== null" :key="contagem" class="cont-numero">{{ contagem }}</div>
        </Transition>

        <!-- LUTAR! -->
        <Transition name="fight-pop">
          <div v-if="fight" class="cont-fight">LUTAR!</div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cont-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(5, 8, 16, 0.86);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: opacity 0.35s ease;
}
.cont-overlay.fade-out { opacity: 0; }

.cont-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,229,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,229,255,0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 55%, transparent 100%);
}

/* ── Números ─────────────────────────────────────────────── */
.cont-numero {
  position: absolute;
  font-size: clamp(96px, 20vw, 220px);
  font-weight: 900;
  color: #fff;
  text-shadow: 0 0 40px rgba(0,229,255,0.8), 0 4px 24px rgba(0,0,0,0.8);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
.count-pop-enter-active { animation: count-in 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
.count-pop-leave-active { animation: count-out 0.18s ease-in; }
@keyframes count-in {
  from { transform: scale(2);   opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
@keyframes count-out {
  from { transform: scale(1);   opacity: 1; }
  to   { transform: scale(0.6); opacity: 0; }
}

/* ── LUTAR! ──────────────────────────────────────────────── */
.cont-fight {
  position: absolute;
  font-size: clamp(52px, 12vw, 130px);
  font-weight: 900;
  color: #FFEA00;
  text-shadow:
    0 0 30px #FFEA00,
    0 0 60px rgba(255,234,0,0.7),
    0 4px 24px rgba(0,0,0,0.9);
  letter-spacing: 6px;
  pointer-events: none;
  user-select: none;
}
.fight-pop-enter-active { animation: fight-in 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.fight-pop-leave-active { animation: fight-out 0.3s ease-in; }
@keyframes fight-in {
  from { transform: scale(0.3) rotate(-6deg); opacity: 0; }
  to   { transform: scale(1) rotate(0deg);    opacity: 1; }
}
@keyframes fight-out {
  from { transform: scale(1);   opacity: 1; }
  to   { transform: scale(1.3); opacity: 0; }
}

/* ── Transição do overlay ───────────────────────────────── */
.cont-overlay-enter-active { animation: overlay-in 0.25s ease; }
.cont-overlay-leave-active { animation: overlay-out 0.3s ease; }
@keyframes overlay-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes overlay-out { from { opacity: 1; } to { opacity: 0; } }
</style>
