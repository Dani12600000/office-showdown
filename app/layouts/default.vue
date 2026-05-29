<script setup lang="ts">
const { perfil, logout, isAdmin } = useAuth()

async function sair() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <v-app-bar flat border="b" color="surface">
    <!-- Logo -->
    <v-app-bar-title>
      <nuxt-link to="/" class="text-decoration-none">
        <span class="text-primary font-weight-black">OFFICE</span>
        <span class="text-secondary font-weight-black ml-1">SHOWDOWN</span>
      </nuxt-link>
    </v-app-bar-title>

    <template #append>
      <!-- Badge de admin -->
      <v-chip v-if="isAdmin" color="accent" size="small" class="mr-3" label>
        <v-icon start size="14">mdi-shield-crown</v-icon>
        Admin
      </v-chip>

      <!-- Menu do utilizador -->
      <v-menu min-width="180">
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="mr-1 text-none" rounded="lg">
            <v-avatar size="32" color="primary" class="mr-2">
              <v-img v-if="perfil?.avatar_url" :src="perfil.avatar_url" />
              <span v-else class="text-body-2 font-weight-bold text-surface">
                {{ perfil?.name?.charAt(0).toUpperCase() }}
              </span>
            </v-avatar>
            <span class="d-none d-sm-inline">{{ perfil?.name }}</span>
            <v-icon end>mdi-chevron-down</v-icon>
          </v-btn>
        </template>

        <v-list density="compact" nav>
          <v-list-item :subtitle="'@' + perfil?.username" prepend-icon="mdi-account-circle-outline">
            <template #title>
              <span class="font-weight-medium">{{ perfil?.name }}</span>
            </template>
          </v-list-item>
          <v-divider class="my-1" />
          <v-list-item
            prepend-icon="mdi-account-edit-outline"
            title="O meu perfil"
            to="/perfil"
          />
          <v-list-item
            prepend-icon="mdi-logout"
            title="Sair"
            base-color="error"
            @click="sair"
          />
        </v-list>
      </v-menu>
    </template>
  </v-app-bar>

  <v-main>
    <slot />
  </v-main>
</template>
