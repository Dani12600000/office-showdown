<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const { carregarPerfil } = useAuth()

// Estados de carregamento do token
const tokenInvalido = ref(false)
const sessaoOk = ref(false)
const userId = ref('')

onMounted(async () => {
  // Lê os tokens diretamente do hash da URL e estabelece a sessão manualmente
  const params = new URLSearchParams(window.location.hash.substring(1))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (!error && data.session?.user) {
      userId.value = data.session.user.id
      sessaoOk.value = true
      // Limpa o hash da URL sem recarregar
      history.replaceState(null, '', window.location.pathname)
      return
    }
  }

  tokenInvalido.value = true
})

// Formulário
const nome = ref('')
const username = ref('')
const password = ref('')
const passwordConfirm = ref('')
const mostrarPassword = ref(false)
const erro = ref('')
const loading = ref(false)

const passwordsIguais = computed(() =>
  !passwordConfirm.value || password.value === passwordConfirm.value
)

const formValido = computed(() =>
  nome.value.trim() &&
  username.value.trim() &&
  password.value.length >= 6 &&
  passwordsIguais.value
)

async function submeter() {
  if (!formValido.value) return
  erro.value = ''
  loading.value = true

  const usernameClean = username.value.trim().toLowerCase()

  try {
    // Verifica se o username já existe
    const { data: existe } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', usernameClean)
      .maybeSingle()

    if (existe) throw new Error('Este username já está a ser utilizado.')

    // Define a password na conta auth
    const { error: authError } = await supabase.auth.updateUser({ password: password.value })
    if (authError) throw new Error(authError.message)

    // Preenche o perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username: usernameClean, name: nome.value.trim() })
      .eq('id', userId.value)

    if (profileError) throw new Error(profileError.message)

    await carregarPerfil(userId.value)
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
          <LogoShowdown subtitulo="Criar conta" />
        </div>

        <!-- Token inválido -->
        <v-card v-if="tokenInvalido" v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-8 text-center">
            <v-icon size="64" color="error" class="mb-4">mdi-link-off</v-icon>
            <h2 class="text-h6 font-weight-bold mb-3">Link inválido ou expirado</h2>
            <p class="text-medium-emphasis text-body-2 mb-6">
              Este convite já não é válido. Pede ao admin que envie um novo.
            </p>
            <v-btn color="primary" to="/login">Ir para o login</v-btn>
          </v-card-text>
        </v-card>

        <!-- A verificar -->
        <v-card v-else-if="!sessaoOk" v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-8 text-center">
            <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
            <p class="text-medium-emphasis text-body-2">A verificar o convite...</p>
          </v-card-text>
        </v-card>

        <!-- Formulário de onboarding -->
        <v-card v-else v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-6">

            <p class="text-body-2 text-medium-emphasis mb-5">
              Bem-vindo ao Office Showdown! Completa as tuas informações para entrar no jogo.
            </p>

            <v-form @submit.prevent="submeter">

              <v-text-field
                v-model="nome"
                label="Nome"
                prepend-inner-icon="mdi-account-outline"
                variant="outlined"
                class="mb-3"
                :disabled="loading"
                hint="O nome que aparece no torneio"
                persistent-hint
              />

              <v-text-field
                v-model="username"
                label="Username"
                prepend-inner-icon="mdi-at"
                variant="outlined"
                class="mb-3"
                :disabled="loading"
                hint="Usado para entrar. Sem espaços, minúsculas."
                persistent-hint
              />

              <v-text-field
                v-model="password"
                label="Password"
                prepend-inner-icon="mdi-lock-outline"
                :type="mostrarPassword ? 'text' : 'password'"
                :append-inner-icon="mostrarPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                class="mb-3"
                :disabled="loading"
                :rules="[v => v.length >= 6 || 'Mínimo 6 caracteres']"
                autocomplete="new-password"
                @click:append-inner="mostrarPassword = !mostrarPassword"
              />

              <v-text-field
                v-model="passwordConfirm"
                label="Confirmar password"
                prepend-inner-icon="mdi-lock-check-outline"
                :type="mostrarPassword ? 'text' : 'password'"
                variant="outlined"
                class="mb-4"
                :disabled="loading"
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
                Entrar no jogo
              </v-btn>

            </v-form>
          </v-card-text>
        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>
