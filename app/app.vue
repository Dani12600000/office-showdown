<template>
  <NuxtRouteAnnouncer />
  <v-app>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </v-app>

  <!-- Splash de carregamento — cobre tudo até a app montar (evita flash de conteúdo) -->
  <SplashScreen />
</template>
