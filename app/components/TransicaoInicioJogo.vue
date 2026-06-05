<script setup lang="ts">
const props = defineProps<{ visivel: boolean }>()
const emit = defineEmits<{ done: [] }>()

const fase = ref<'entrar' | 'mostrar' | 'sair'>('entrar')

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

watch(() => props.visivel, async (v) => {
  if (!v) return
  fase.value = 'entrar'
  await delay(200)
  fase.value = 'mostrar'
  await delay(2600)
  fase.value = 'sair'
  await delay(500)
  emit('done')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="inicio-overlay">
      <div v-if="visivel" class="inicio-overlay" :class="fase">
        <div class="inicio-grid" />

        <div class="inicio-conteudo">
          <div class="inicio-icon" :class="{ show: fase === 'mostrar' }">
            <v-icon size="96" color="accent">mdi-trophy</v-icon>
          </div>
          <div class="inicio-titulo" :class="{ show: fase === 'mostrar' }">
            OS JOGOS<br>COMEÇAM!
          </div>
          <div class="inicio-subtitulo" :class="{ show: fase === 'mostrar' }">
            Que o melhor vença
          </div>
        </div>

        <!-- Raios de luz saindo do centro -->
        <div class="inicio-raios">
          <div v-for="i in 12" :key="i" class="raio" :style="`--r: ${i * 30}deg`" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.inicio-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: #050810;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: opacity 0.4s ease;
}
.inicio-overlay.sair { opacity: 0; }

.inicio-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,214,0,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,214,0,0.05) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
}

/* Raios */
.inicio-raios {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.raio {
  position: absolute;
  width: 2px;
  height: 45vmax;
  background: linear-gradient(to bottom, rgba(255,214,0,0.25), transparent);
  transform-origin: top center;
  transform: rotate(var(--r)) translateX(-50%);
  animation: raio-spin 8s linear infinite;
}
@keyframes raio-spin {
  from { transform: rotate(var(--r)) translateX(-50%); }
  to   { transform: rotate(calc(var(--r) + 360deg)) translateX(-50%); }
}

/* Conteúdo central */
.inicio-conteudo {
  position: relative;
  z-index: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.inicio-icon {
  transform: scale(0.2);
  opacity: 0;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease;
  filter: drop-shadow(0 0 40px rgba(255,214,0,0.8));
}
.inicio-icon.show { transform: scale(1); opacity: 1; }

.inicio-titulo {
  font-size: clamp(48px, 8vw, 100px);
  font-weight: 900;
  line-height: 1.05;
  color: #FFEA00;
  text-shadow:
    0 0 30px #FFEA00,
    0 0 60px rgba(255,234,0,0.6),
    0 4px 32px rgba(0,0,0,0.9);
  letter-spacing: 4px;
  transform: translateY(30px);
  opacity: 0;
  transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s, opacity 0.5s ease 0.15s;
  animation: titulo-pulse 1.5s ease-in-out 0.8s infinite alternate;
}
.inicio-titulo.show { transform: translateY(0); opacity: 1; }

@keyframes titulo-pulse {
  from { text-shadow: 0 0 30px #FFEA00, 0 0 60px rgba(255,234,0,0.6); }
  to   { text-shadow: 0 0 50px #FFEA00, 0 0 100px rgba(255,234,0,0.8); }
}

.inicio-subtitulo {
  font-size: clamp(16px, 2.5vw, 28px);
  font-weight: 500;
  color: rgba(255,255,255,0.6);
  letter-spacing: 6px;
  text-transform: uppercase;
  transform: translateY(16px);
  opacity: 0;
  transition: transform 0.6s ease 0.4s, opacity 0.5s ease 0.4s;
}
.inicio-subtitulo.show { transform: translateY(0); opacity: 1; }

/* Transição do overlay */
.inicio-overlay-enter-active { animation: fade-in 0.3s ease; }
.inicio-overlay-leave-active { animation: fade-out 0.3s ease; }
@keyframes fade-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
</style>
