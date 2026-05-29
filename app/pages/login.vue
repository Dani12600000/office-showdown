<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login, isLoggedIn } = useAuth()

const username = ref('')
const password = ref('')
const erro = ref('')
const loading = ref(false)

// Se já está autenticado, redirecionar
if (isLoggedIn.value) {
  await navigateTo('/')
}

async function submeter() {
  erro.value = ''
  loading.value = true
  try {
    await login(username.value, password.value)
    await navigateTo('/')
  } catch (e: any) {
    erro.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container fluid class="pt-16">
    <v-row justify="center">
      <v-col cols="12" sm="8" md="4">
        <div v-motion-fade class="mb-8">
          <LogoShowdown />
        </div>

        <v-card v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-6">
            <v-form @submit.prevent="submeter">
              <v-text-field
                v-model="username"
                label="Username"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                class="mb-3"
                autocomplete="username"
                :disabled="loading"
              />
              <v-text-field
                v-model="password"
                label="Password"
                prepend-inner-icon="mdi-lock"
                type="password"
                variant="outlined"
                class="mb-4"
                autocomplete="current-password"
                :disabled="loading"
              />
              <v-alert v-if="erro" type="error" variant="tonal" class="mb-4" closable @click:close="erro = ''">
                {{ erro }}
              </v-alert>
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
              >
                Entrar
              </v-btn>
            </v-form>
          </v-card-text>

          <v-divider />

          <v-card-actions class="justify-center pa-4">
            <span class="text-body-2 text-medium-emphasis">Ainda não tens conta?</span>
            <v-btn variant="text" color="primary" size="small" to="/signup" class="ml-1">
              Criar conta
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
