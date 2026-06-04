<script setup lang="ts">
import type { Database } from '~/types/database.types'

const aberto = defineModel<boolean>({ default: false })

const supabase = useSupabaseClient<Database>()
const { perfil: perfilAtual } = useAuth()

const tab = ref('convidar')

// ---- Convidar ----
const email = ref('')
const loadingConvite = ref(false)
const erroConvite = ref('')
const enviados = ref<string[]>([])

const emailValido = computed(() =>
  !email.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
)

async function convidar() {
  if (!email.value || !emailValido.value) return
  erroConvite.value = ''
  loadingConvite.value = true
  try {
    await $fetch('/api/convidar', { method: 'POST', body: { email: email.value } })
    enviados.value.unshift(email.value)
    email.value = ''
  } catch (e: any) {
    erroConvite.value = e.data?.message ?? e.message
  } finally {
    loadingConvite.value = false
  }
}

// ---- Gestão de admins ----
type Utilizador = { id: string; name: string; username: string; admin: boolean; avatar_url: string | null }

const utilizadores = ref<Utilizador[]>([])
const loadingUtilizadores = ref(false)
const togglingId = ref<string | null>(null)
const erroAdmins = ref('')
const pesquisa = ref('')

const utilizadoresFiltrados = computed(() => {
  const q = pesquisa.value.trim().toLowerCase()
  if (!q) return utilizadores.value
  return utilizadores.value.filter(u =>
    u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
  )
})

async function carregarUtilizadores() {
  loadingUtilizadores.value = true
  const { data } = await supabase
    .from('profiles')
    .select('id, name, username, admin, avatar_url')
    .eq('is_bot', false)
    .order('name')
  utilizadores.value = (data ?? []) as Utilizador[]
  loadingUtilizadores.value = false
}

async function toggleAdmin(u: Utilizador) {
  togglingId.value = u.id
  erroAdmins.value = ''
  try {
    await $fetch(`/api/admin/${u.id}`, {
      method: 'PATCH',
      body: { novoAdmin: !u.admin },
    })
    u.admin = !u.admin
  } catch (e: any) {
    erroAdmins.value = e.data?.message ?? e.message
  } finally {
    togglingId.value = null
  }
}

watch(aberto, (v) => {
  if (v) carregarUtilizadores()
})

watch(tab, (v) => {
  if (v === 'admins' && !utilizadores.value.length) carregarUtilizadores()
})
</script>

<template>
  <v-dialog v-model="aberto" max-width="540" scrollable>
    <v-card rounded="xl">

      <!-- Cabeçalho -->
      <v-card-title class="d-flex align-center pa-6 pb-0">
        <v-icon color="accent" class="mr-2">mdi-shield-crown</v-icon>
        <span class="text-h6 font-weight-bold">Painel de Admin</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="aberto = false" />
      </v-card-title>

      <!-- Tabs -->
      <v-tabs v-model="tab" color="primary" class="px-4">
        <v-tab value="convidar" prepend-icon="mdi-email-plus-outline">Convidar</v-tab>
        <v-tab value="admins" prepend-icon="mdi-shield-account-outline">Admins</v-tab>
      </v-tabs>

      <v-divider />

      <v-card-text class="pa-6">
        <v-tabs-window v-model="tab">

          <!-- ---- Tab: Convidar ---- -->
          <v-tabs-window-item value="convidar">
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
              :disabled="loadingConvite"
              autocomplete="off"
              @keyup.enter="convidar"
            />

            <v-alert v-if="erroConvite" type="error" variant="tonal" density="compact" class="mb-4" closable @click:close="erroConvite = ''">
              {{ erroConvite }}
            </v-alert>

            <v-btn
              color="primary"
              block
              size="large"
              :loading="loadingConvite"
              :disabled="!email || !emailValido"
              prepend-icon="mdi-send-outline"
              @click="convidar"
            >
              Enviar convite
            </v-btn>

            <template v-if="enviados.length">
              <v-divider class="my-6" />
              <p class="text-subtitle-2 font-weight-bold text-medium-emphasis text-uppercase mb-3" style="letter-spacing:0.08em;">
                Enviados nesta sessão
              </p>
              <v-list density="compact" rounded="lg" bg-color="surface-variant">
                <v-list-item v-for="e in enviados" :key="e" :title="e">
                  <template #prepend>
                    <v-icon color="success" size="18" class="mr-3">mdi-email-check-outline</v-icon>
                  </template>
                </v-list-item>
              </v-list>
            </template>
          </v-tabs-window-item>

          <!-- ---- Tab: Admins ---- -->
          <v-tabs-window-item value="admins">
            <p class="text-body-2 text-medium-emphasis mb-4">
              Ativa ou desativa o acesso de admin. Não podes alterar o teu próprio status.
            </p>

            <v-text-field
              v-model="pesquisa"
              label="Pesquisar"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              clearable
              class="mb-3"
            />

            <v-alert v-if="erroAdmins" type="error" variant="tonal" density="compact" class="mb-3" closable @click:close="erroAdmins = ''">
              {{ erroAdmins }}
            </v-alert>

            <div v-if="loadingUtilizadores" class="text-center py-6">
              <v-progress-circular indeterminate color="primary" size="36" />
            </div>

            <v-list v-else lines="two" rounded="lg">
              <v-list-item
                v-for="u in utilizadoresFiltrados"
                :key="u.id"
                :subtitle="'@' + u.username"
              >
                <template #prepend>
                  <v-avatar size="40" color="primary" class="mr-3">
                    <v-img v-if="u.avatar_url" :src="u.avatar_url" />
                    <span v-else class="text-body-2 font-weight-bold text-surface">
                      {{ u.name?.charAt(0).toUpperCase() }}
                    </span>
                  </v-avatar>
                </template>

                <template #title>
                  <span class="font-weight-medium">{{ u.name }}</span>
                  <v-chip v-if="u.admin" color="accent" size="x-small" label class="ml-2">Admin</v-chip>
                </template>

                <template #append>
                  <v-switch
                    :model-value="u.admin"
                    color="accent"
                    hide-details
                    density="compact"
                    :disabled="u.id === perfilAtual?.id || togglingId === u.id"
                    :loading="togglingId === u.id"
                    @update:model-value="toggleAdmin(u)"
                  />
                </template>
              </v-list-item>

              <v-list-item v-if="!utilizadoresFiltrados.length" class="text-center text-medium-emphasis py-4">
                Nenhum utilizador encontrado.
              </v-list-item>
            </v-list>

          </v-tabs-window-item>

        </v-tabs-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
