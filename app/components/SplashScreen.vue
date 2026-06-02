<script setup lang="ts">
// Visível por defeito (renderiza já no SSR/primeiro paint → sem flash de conteúdo).
// Desvanece assim que a app monta no cliente.
const visivel = useState('splash_visivel', () => true)
const aSair = ref(false)

onMounted(async () => {
  // pequeno mínimo para a animação não "piscar" em ligações rápidas
  await new Promise(r => setTimeout(r, 650))
  aSair.value = true
  // espera a transição de fade terminar antes de remover do DOM
  setTimeout(() => { visivel.value = false }, 500)
})
</script>

<template>
  <div v-if="visivel" class="splash" :class="{ 'splash--out': aSair }">
    <div class="splash-inner">
      <LogoShowdown />
      <div class="splash-loader">
        <span class="dot" />
        <span class="dot" />
        <span class="dot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(900px 500px at 20% -10%, rgba(0, 229, 255, 0.12), transparent 60%),
    radial-gradient(900px 500px at 80% 110%, rgba(255, 23, 68, 0.12), transparent 60%),
    #0D0D1A;
  transition: opacity 0.5s ease, transform 0.5s ease;
  /* dvh = altura real no telemóvel (conta com a barra do browser) */
  min-height: 100dvh;
}
.splash--out {
  opacity: 0;
  transform: scale(1.04);
  pointer-events: none;
}

.splash-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: subir 0.5s ease both;
}
@keyframes subir {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.splash-loader {
  display: flex;
  gap: 10px;
  margin-top: 36px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #00E5FF;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.7);
  animation: pulsar 1.1s ease-in-out infinite;
}
.dot:nth-child(2) { background: #FF1744; box-shadow: 0 0 12px rgba(255, 23, 68, 0.7); animation-delay: 0.18s; }
.dot:nth-child(3) { background: #FFD600; box-shadow: 0 0 12px rgba(255, 214, 0, 0.7); animation-delay: 0.36s; }

@keyframes pulsar {
  0%, 100% { transform: scale(0.6); opacity: 0.4; }
  50%      { transform: scale(1);   opacity: 1; }
}

/* Reduz movimento para quem tem essa preferência */
@media (prefers-reduced-motion: reduce) {
  .splash-inner, .dot { animation: none; }
}
</style>
