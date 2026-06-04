<script setup lang="ts">
const aberto = defineModel<boolean>({ default: false })

const email = ref('')
const loading = ref(false)
const erro = ref('')
const enviados = ref<string[]>([])

const emailValido = computed(() =>
  !email.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
)

async function convidar() {
  if (!email.value || !emailValido.value) return
  erro.value = ''
  loading.value = true
  try {
    await $fetch('/api/convidar', {
      method: 'POST',
      body: { email: email.value },
    })
    enviados.value.unshift(email.value)
    email.value = ''
  } catch (e: any) {
    erro.value = e.data?.message ?? e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="aberto" max-width="520" scrollable>
    <v-card rounded="xl">

      <!-- Cabeçalho -->
      <v-card-title class="d-flex align-center pa-6 pb-4">
        <v-icon color="accent" class="mr-2">mdi-shield-crown</v-icon>
        <span class="text-h6 font-weight-bold">Painel de Admin</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="aberto = false" />
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-6">

        <!-- Secção: convidar -->
        <p class="text-subtitle-2 font-weight-bold text-medium-emphasis text-uppercase mb-4" style="letter-spacing:0.08em;">
          Convidar utilizador
        </p>
        <p class="text-body-2 text-medium-emphasis mb-4">
          O convidado receberá um email para criar a conta. Ao aceitar, escolhe o username, o nome e a password.
        </p>

        <v-text-field
          v-model="email"
          label="Email do convidado"
          prepend-inner-icon="mdi-email-plus-outline"
          type="email"
          variant="outlined"
          :error-messages="!emailValido ? 'Email inválido' : ''"
          :disabled="loading"
          autocomplete="off"
          @keyup.enter="convidar"
        />

        <v-alert v-if="erro" type="error" variant="tonal" density="compact" class="mb-4" closable @click:close="erro = ''">
          {{ erro }}
        </v-alert>

        <v-btn
          color="primary"
          block
          size="large"
          :loading="loading"
          :disabled="!email || !emailValido"
          prepend-icon="mdi-send-outline"
          @click="convidar"
        >
          Enviar convite
        </v-btn>

        <!-- Lista de convites enviados nesta sessão -->
        <template v-if="enviados.length">
          <v-divider class="my-6" />
          <p class="text-subtitle-2 font-weight-bold text-medium-emphasis text-uppercase mb-3" style="letter-spacing:0.08em;">
            Enviados nesta sessão
          </p>
          <v-list density="compact" rounded="lg" bg-color="surface-variant">
            <v-list-item
              v-for="e in enviados"
              :key="e"
              :title="e"
              prepend-icon="mdi-email-check-outline"
            >
              <template #prepend>
                <v-icon color="success" size="18" class="mr-3">mdi-email-check-outline</v-icon>
              </template>
            </v-list-item>
          </v-list>
        </template>

      </v-card-text>
    </v-card>
  </v-dialog>
</template>
