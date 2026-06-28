<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { signup, usernameDisponivel, isLoggedIn } = useAuth()

if (isLoggedIn.value) {
  await navigateTo('/')
}

const nome = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const erro = ref('')
const loading = ref(false)
const mostrarPassword = ref(false)
const confirmacaoPendente = ref(false)

// ---- Validação do username (formato + disponibilidade ao vivo) ----
// Estado: '' (vazio), 'invalido', 'verificar', 'livre', 'ocupado', 'erro'
const usernameEstado = ref<'' | 'invalido' | 'verificar' | 'livre' | 'ocupado' | 'erro'>('')
const formatoUsernameOk = (u: string) => /^[a-z0-9._]{3,20}$/.test(u)

// Normaliza enquanto se escreve: minúsculas, sem espaços nem acentos/símbolos.
watch(username, (v) => {
  const limpo = v
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acentos
    .replace(/[^a-z0-9._]/g, '')                         // só letras/números/._
  if (limpo !== v) username.value = limpo
})

// Verifica disponibilidade com debounce sempre que o username muda.
let debounce: ReturnType<typeof setTimeout> | null = null
watch(username, (v) => {
  if (debounce) clearTimeout(debounce)
  if (!v) { usernameEstado.value = ''; return }
  if (!formatoUsernameOk(v)) { usernameEstado.value = 'invalido'; return }
  usernameEstado.value = 'verificar'
  debounce = setTimeout(async () => {
    try {
      usernameEstado.value = (await usernameDisponivel(v)) ? 'livre' : 'ocupado'
    } catch {
      usernameEstado.value = 'erro'
    }
  }, 450)
})

const usernameMsg = computed(() => ({
  '': '',
  invalido: '3–20 caracteres: letras minúsculas, números, ponto ou _',
  verificar: 'A verificar disponibilidade…',
  livre: 'Username disponível ✓',
  ocupado: 'Este username já está a ser utilizado.',
  erro: 'Não foi possível verificar agora.',
}[usernameEstado.value]))

const emailValido = computed(() =>
  !email.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
)

const passwordsIguais = computed(() =>
  !passwordConfirm.value || password.value === passwordConfirm.value
)

const formValido = computed(() =>
  nome.value.trim() &&
  usernameEstado.value === 'livre' &&
  emailValido.value &&
  email.value.trim() &&
  password.value.length >= 6 &&
  passwordsIguais.value
)

async function submeter() {
  if (!formValido.value) return
  erro.value = ''
  loading.value = true
  try {
    const { confirmacaoPendente: pendente } = await signup(username.value, nome.value, email.value, password.value)
    if (pendente) {
      confirmacaoPendente.value = true
    } else {
      await navigateTo('/')
    }
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

        <!-- Cabeçalho -->
        <div v-motion-fade class="mb-8">
          <LogoShowdown :subtitulo="confirmacaoPendente ? '' : 'Criar conta'" />
        </div>

        <!-- Ecrã de confirmação pendente -->
        <v-card v-if="confirmacaoPendente" v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-8 text-center">
            <v-icon size="64" color="primary" class="mb-4">mdi-email-check-outline</v-icon>
            <h2 class="text-h6 font-weight-bold mb-3">Verifica o teu email</h2>
            <p class="text-medium-emphasis text-body-2 mb-6">
              Enviámos um link de confirmação para <strong>{{ email }}</strong>.<br>
              Clica no link para entrares no jogo. Após confirmar, serás redirecionado automaticamente.
            </p>
            <v-btn variant="text" color="primary" to="/login">Ir para o login</v-btn>
          </v-card-text>
        </v-card>

        <!-- Card de registo -->
        <v-card v-else v-motion-slide-visible-bottom elevation="8">
          <v-card-text class="pa-6">
            <v-form @submit.prevent="submeter">

              <!-- Nome de exibição -->
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

              <!-- Username -->
              <v-text-field
                v-model="username"
                label="Username"
                prepend-inner-icon="mdi-at"
                variant="outlined"
                class="mb-3"
                :disabled="loading"
                :error-messages="['invalido', 'ocupado'].includes(usernameEstado) ? usernameMsg : ''"
                :messages="['', 'verificar', 'livre', 'erro'].includes(usernameEstado) ? (usernameMsg || 'Usado para entrar. Sem espaços, minúsculas.') : ''"
                :color="usernameEstado === 'livre' ? 'success' : undefined"
                autocapitalize="none"
                autocomplete="username"
              >
                <template #append-inner>
                  <v-progress-circular v-if="usernameEstado === 'verificar'" size="18" width="2" indeterminate color="primary" />
                  <v-icon v-else-if="usernameEstado === 'livre'" color="success">mdi-check-circle</v-icon>
                  <v-icon v-else-if="usernameEstado === 'ocupado'" color="error">mdi-close-circle</v-icon>
                </template>
              </v-text-field>

              <!-- Email -->
              <v-text-field
                v-model="email"
                label="Email"
                prepend-inner-icon="mdi-email-outline"
                type="email"
                variant="outlined"
                class="mb-3"
                :disabled="loading"
                :error-messages="!emailValido ? 'Email inválido' : ''"
                autocomplete="email"
              />

              <!-- Password -->
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

              <!-- Confirmar password -->
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

              <!-- Erro geral -->
              <v-alert v-if="erro" type="error" variant="tonal" class="mb-4" closable @click:close="erro = ''">
                {{ erro }}
              </v-alert>

              <!-- Botão submeter -->
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="!formValido"
              >
                Criar conta
              </v-btn>

            </v-form>
          </v-card-text>

          <v-divider />

          <!-- Link para login -->
          <v-card-actions class="justify-center pa-4">
            <span class="text-body-2 text-medium-emphasis">Já tens conta?</span>
            <v-btn variant="text" color="primary" size="small" to="/login" class="ml-1">
              Entrar
            </v-btn>
          </v-card-actions>
        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>
