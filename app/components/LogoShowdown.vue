<script setup lang="ts">
withDefaults(defineProps<{ subtitulo?: string }>(), { subtitulo: '' })
</script>

<template>
  <div class="logo text-center">
    <div class="logo-linha">
      <span class="logo-office">OFFICE</span>
      <span class="logo-showdown">SHOWDOWN</span>
    </div>
    <div class="logo-barra">
      <span class="barra barra--azul" />
      <!-- SVG inline (em vez de v-icon/webfont) para sobreviver à rasterização
           do cartão de partilha (html-to-image) — renderiza igual na app. -->
      <svg class="logo-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.29C1.27,19.68 1.27,20.31 1.66,20.7L2.37,21.41C2.76,21.8 3.39,21.8 3.78,21.41L7,18.23L9.44,20.7L10.85,19.29L8.73,17.17L10.94,15Z" />
      </svg>
      <span class="barra barra--vermelho" />
    </div>
    <p v-if="subtitulo" class="logo-sub">{{ subtitulo }}</p>
  </div>
</template>

<style scoped>
.logo-linha {
  line-height: 0.92;
}

.logo-office,
.logo-showdown {
  display: block;
  text-align: center;
  font-weight: 900;
  font-size: clamp(2.5rem, 8vw, 4rem);
  letter-spacing: 0.04em;
  /* compensa o espaço extra que o letter-spacing cria à direita */
  text-indent: 0.04em;
}

.logo-office {
  color: #00E5FF;
  text-shadow: 0 0 24px rgba(0, 229, 255, 0.55);
}

.logo-showdown {
  color: #FF1744;
  text-shadow: 0 0 24px rgba(255, 23, 68, 0.55);
}

.logo-barra {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}

.barra {
  height: 3px;
  width: 48px;
  border-radius: 2px;
}
.barra--azul     { background: linear-gradient(90deg, transparent, #00E5FF); }
.barra--vermelho { background: linear-gradient(90deg, #FF1744, transparent); }

.logo-icon {
  color: rgba(255, 255, 255, 0.6);
}

.logo-sub {
  margin-top: 10px;
  font-size: 0.875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}
</style>
