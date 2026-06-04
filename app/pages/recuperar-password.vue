<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { pedirResetPassword, isLoggedIn } = useAuth()

if (isLoggedIn.value) {
  await navigateTo('/')
}

const username = ref('')
const erro = ref('')
const loading = ref(false)
const enviado = ref(false)

async function submeter() {
  if (!username.value.trim()) return
  erro.value = ''
  loading.value = true
  try {
    await pedirResetPassword(username.value)
    enviado.value = true
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
          <LogoShowdown subtitulo="Recuperar password" />
        </div>

        <!-- Estado: email enviado -->
        <v-card v-if="enviado" v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-8 text-center">
            <v-icon size="64" color="primary" class="mb-4">mdi-email-check-outline</v-icon>
            <h2 class="text-h6 font-weight-bold mb-3">Verifica o teu email</h2>
            <p class="text-medium-emphasis text-body-2 mb-6">
              Enviámos um link para redefinires a tua password. Verifica também a pasta de spam.
            </p>
            <v-btn variant="text" color="primary" to="/login">Voltar ao login</v-btn>
          </v-card-text>
        </v-card>

        <!-- Formulário -->
        <v-card v-else v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-6">
            <p class="text-body-2 text-medium-emphasis mb-5">
              Introduz o teu username e enviamos um link para o email associado à tua conta.
            </p>
            <v-form @submit.prevent="submeter">
              <v-text-field
                v-model="username"
                label="Username"
                prepend-inner-icon="mdi-at"
                variant="outlined"
                class="mb-4"
                autocomplete="username"
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
                :disabled="!username.trim()"
              >
                Enviar link
              </v-btn>
            </v-form>
          </v-card-text>

          <v-divider />

          <v-card-actions class="justify-center pa-4">
            <v-btn variant="text" color="primary" size="small" to="/login">
              Voltar ao login
            </v-btn>
          </v-card-actions>
        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>
