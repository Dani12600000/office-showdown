<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { atualizarPassword } = useAuth()
const supabaseUser = useSupabaseUser()

const tokenInvalido = ref(false)
const sessaoOk = ref(false)

onMounted(() => {
  if (supabaseUser.value?.id) {
    sessaoOk.value = true
  } else {
    tokenInvalido.value = true
  }
})

const password = ref('')
const passwordConfirm = ref('')
const mostrarPassword = ref(false)
const erro = ref('')
const loading = ref(false)
const concluido = ref(false)

const passwordsIguais = computed(() =>
  !passwordConfirm.value || password.value === passwordConfirm.value
)

const formValido = computed(() =>
  password.value.length >= 6 && passwordsIguais.value
)

async function submeter() {
  if (!formValido.value) return
  erro.value = ''
  loading.value = true
  try {
    await atualizarPassword(password.value)
    concluido.value = true
    setTimeout(() => navigateTo('/'), 2500)
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
          <LogoShowdown subtitulo="Nova password" />
        </div>

        <!-- Token inválido / expirado -->
        <v-card v-if="tokenInvalido" v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-8 text-center">
            <v-icon size="64" color="error" class="mb-4">mdi-link-off</v-icon>
            <h2 class="text-h6 font-weight-bold mb-3">Link inválido ou expirado</h2>
            <p class="text-medium-emphasis text-body-2 mb-6">
              Este link de recuperação já não é válido. Pede um novo.
            </p>
            <v-btn color="primary" to="/recuperar-password">Pedir novo link</v-btn>
          </v-card-text>
        </v-card>

        <!-- Sucesso -->
        <v-card v-else-if="concluido" v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-8 text-center">
            <v-icon size="64" color="success" class="mb-4">mdi-check-circle-outline</v-icon>
            <h2 class="text-h6 font-weight-bold mb-3">Password atualizada!</h2>
            <p class="text-medium-emphasis text-body-2">
              A tua password foi alterada com sucesso. A redirecionar...
            </p>
          </v-card-text>
        </v-card>

        <!-- A carregar sessão -->
        <v-card v-else-if="!sessaoOk" v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-8 text-center">
            <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
            <p class="text-medium-emphasis text-body-2">A verificar o link...</p>
          </v-card-text>
        </v-card>

        <!-- Formulário de nova password -->
        <v-card v-else v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-6">
            <v-form @submit.prevent="submeter">

              <v-text-field
                v-model="password"
                label="Nova password"
                prepend-inner-icon="mdi-lock-outline"
                :type="mostrarPassword ? 'text' : 'password'"
                :append-inner-icon="mostrarPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                class="mb-3"
                :rules="[v => v.length >= 6 || 'Mínimo 6 caracteres']"
                autocomplete="new-password"
                @click:append-inner="mostrarPassword = !mostrarPassword"
              />

              <v-text-field
                v-model="passwordConfirm"
                label="Confirmar nova password"
                prepend-inner-icon="mdi-lock-check-outline"
                :type="mostrarPassword ? 'text' : 'password'"
                variant="outlined"
                class="mb-4"
                :error-messages="!passwordsIguais ? 'As passwords não coincidem' : ''"
                autocomplete="new-password"
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
                :disabled="!formValido"
              >
                Guardar nova password
              </v-btn>

            </v-form>
          </v-card-text>
        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>
