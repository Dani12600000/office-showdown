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
      <v-icon size="16" class="logo-icon">mdi-sword-cross</v-icon>
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
