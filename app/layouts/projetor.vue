<template>
  <div class="projetor-bg">
    <slot />
  </div>
</template>

<style scoped>
.projetor-bg {
  min-height: 100vh;
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(0, 229, 255, 0.10), transparent 60%),
    radial-gradient(1200px 600px at 80% 110%, rgba(255, 23, 68, 0.10), transparent 60%),
    #0D0D1A;
}
</style>
