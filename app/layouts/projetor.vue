<script setup lang="ts">
// O projetor ocupa o ecrã exato — sem scroll. Aplica/remove no body em vez
// de um <style> global para não afetar as outras páginas.
if (import.meta.client) {
  onMounted(() => {
    document.documentElement.classList.add('no-scroll')
    document.body.classList.add('no-scroll')
  })
  onUnmounted(() => {
    document.documentElement.classList.remove('no-scroll')
    document.body.classList.remove('no-scroll')
  })
}
</script>

<template>
  <div class="projetor-bg">
    <slot />
  </div>
</template>

<style scoped>
.projetor-bg {
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(0, 229, 255, 0.10), transparent 60%),
    radial-gradient(1200px 600px at 80% 110%, rgba(255, 23, 68, 0.10), transparent 60%),
    #0D0D1A;
}
</style>

<style>
.no-scroll { overflow: hidden !important; height: 100vh !important; }
</style>
