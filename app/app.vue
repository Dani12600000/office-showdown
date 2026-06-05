<template>
  <NuxtRouteAnnouncer />
  <v-app>
    <NuxtLayout>
      <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
    </NuxtLayout>
  </v-app>

  <!-- Splash de carregamento — cobre tudo até a app montar (evita flash de conteúdo) -->
  <SplashScreen />
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
