<script setup lang="ts">
import type { TorneioCard } from '~/composables/useTorneios'
import type { StatusTorneio, NumeroRonda } from '~/types/torneio'

definePageMeta({ middleware: 'auth' })

const { perfil, isAdmin } = useAuth()
const { torneios, loading, carregarTorneios, inscreverMe, JOGO_POR_RONDA, NOME_RONDA } = useTorneios()
const { criarTorneio } = useLobby('')

// ---- Criar torneio (admin) ----
const dialogCriar = ref(false)
const nomeTorneio = ref('')
const aCriar = ref(false)
const erroCriar = ref('')

async function submeterCriarTorneio() {
  if (!nomeTorneio.value.trim()) return
  aCriar.value = true
  erroCriar.value = ''
  try {
    const id = await criarTorneio(nomeTorneio.value.trim())
    dialogCriar.value = false
    nomeTorneio.value = ''
    await navigateTo(`/torneio/${id}`)
  } catch (e: any) {
    erroCriar.value = e.message
  } finally {
    aCriar.value = false
  }
}

// Quando o perfil ficar disponível (login direto ou refresh de página),
// carrega os torneios. O watch com immediate:true cobre os dois casos.
watch(perfil, async (p) => {
  if (p) await carregarTorneios()
}, { immediate: true })

// ---- Configurações visuais por status do torneio ----
const statusConfig: Record<StatusTorneio, { label: string; color: string; icon: string }> = {
  LOBBY:  { label: 'A aceitar inscrições', color: 'success',   icon: 'mdi-door-open' },
  ARVORE: { label: 'A sortear',            color: 'primary',   icon: 'mdi-tournament' },
  JOGO:   { label: 'Em jogo',              color: 'secondary', icon: 'mdi-sword-cross' },
  FINAL:  { label: 'Grande Final!',        color: 'accent',    icon: 'mdi-trophy' },
}

const jogoIcon: Record<NumeroRonda, string> = {
  1: 'mdi-hand-wave',
  2: 'mdi-grid',
  3: 'mdi-dots-grid',
  4: 'mdi-ship-wheel',
}

// ---- Inscrição com feedback ----
const inscrevendo = ref<string | null>(null)
// boolean separado para controlar a visibilidade do snackbar
const mostrarErro = ref(false)
const mensagemErro = ref('')

async function entrarNoTorneio(torneio: TorneioCard, status: 'QUER_JOGAR' | 'PLATEIA' = 'QUER_JOGAR') {
  inscrevendo.value = torneio.id
  try {
    await inscreverMe(torneio.id, status)
  } catch (e: any) {
    mensagemErro.value = e.message
    mostrarErro.value = true
  } finally {
    inscrevendo.value = null
  }
}

// ---- Label da minha participação ----
const participacaoConfig = {
  QUER_JOGAR:         { label: 'Inscrito',   color: 'warning', icon: 'mdi-clock-outline' },
  JOGADOR_CONFIRMADO: { label: 'Confirmado', color: 'success', icon: 'mdi-check-circle' },
  PLATEIA:            { label: 'Plateia',    color: 'primary', icon: 'mdi-eye' },
}
</script>

<template>
  <v-container class="py-8" max-width="900">

    <!-- Saudação -->
    <div v-motion-fade class="d-flex align-center justify-space-between mb-8 flex-wrap gap-3">
      <div>
        <h2 class="text-h5 font-weight-bold">
          Olá, <span class="text-primary">{{ perfil?.name }}</span> 👋
        </h2>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Escolhe um torneio para entrar ou acompanhar.
        </p>
      </div>

      <!-- Botão criar torneio — só admins vêem -->
      <v-btn
        v-if="isAdmin"
        color="secondary"
        prepend-icon="mdi-plus-circle"
        @click="dialogCriar = true"
      >
        Criar Torneio
      </v-btn>
    </div>

    <!-- Dialog criar torneio -->
    <v-dialog v-model="dialogCriar" max-width="420" persistent>
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-2 text-h6 font-weight-bold">Novo Torneio</v-card-title>
        <v-card-text class="pa-6 pt-2">
          <v-text-field
            v-model="nomeTorneio"
            label="Nome do torneio"
            prepend-inner-icon="mdi-trophy-outline"
            variant="outlined"
            autofocus
            :disabled="aCriar"
            @keyup.enter="submeterCriarTorneio"
          />
          <v-alert v-if="erroCriar" type="error" variant="tonal" density="compact" class="mt-2">
            {{ erroCriar }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="px-6 pb-6 pt-0 gap-2">
          <v-btn variant="text" :disabled="aCriar" @click="dialogCriar = false; nomeTorneio = ''">
            Cancelar
          </v-btn>
          <v-spacer />
          <v-btn
            color="secondary"
            :loading="aCriar"
            :disabled="!nomeTorneio.trim()"
            @click="submeterCriarTorneio"
          >
            Criar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Estado de carregamento -->
    <div v-if="loading" class="d-flex justify-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <!-- Sem torneios -->
    <div v-else-if="!torneios.length" class="text-center py-16">
      <v-icon size="64" color="surface-variant">mdi-trophy-outline</v-icon>
      <p class="text-h6 mt-4 text-medium-emphasis">Nenhum torneio ativo de momento.</p>
      <p class="text-body-2 text-medium-emphasis">Aguarda que um Admin crie um torneio.</p>
    </div>

    <!-- Lista de torneios -->
    <v-row v-else>
      <v-col
        v-for="torneio in torneios"
        :key="torneio.id"
        cols="12"
        md="6"
      >
        <v-card
          v-motion-slide-visible-bottom
          :border="`${statusConfig[torneio.status].color} thin`"
          rounded="xl"
          class="h-100"
        >
          <!-- Cabeçalho do card -->
          <v-card-item>
            <template #prepend>
              <v-avatar
                :color="statusConfig[torneio.status].color"
                variant="tonal"
                size="48"
                rounded="lg"
              >
                <v-icon>{{ statusConfig[torneio.status].icon }}</v-icon>
              </v-avatar>
            </template>

            <v-card-title class="font-weight-bold">{{ torneio.nome }}</v-card-title>
            <v-card-subtitle>
              <v-chip
                :color="statusConfig[torneio.status].color"
                size="x-small"
                label
                class="mt-1"
              >
                {{ statusConfig[torneio.status].label }}
              </v-chip>
            </v-card-subtitle>
          </v-card-item>

          <v-divider />

          <!-- Detalhes -->
          <v-card-text>
            <v-row dense>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">Fase</div>
                <div class="text-body-2 font-weight-medium mt-1">
                  {{ NOME_RONDA[torneio.ronda_atual as NumeroRonda] }}
                </div>
              </v-col>

              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">Jogo</div>
                <div class="d-flex align-center mt-1">
                  <v-icon size="16" class="mr-1" :color="statusConfig[torneio.status].color">
                    {{ jogoIcon[torneio.ronda_atual as NumeroRonda] }}
                  </v-icon>
                  <span class="text-body-2 font-weight-medium">
                    {{ JOGO_POR_RONDA[torneio.ronda_atual as NumeroRonda] }}
                  </span>
                </div>
              </v-col>

              <v-col cols="6" class="mt-2">
                <div class="text-caption text-medium-emphasis">Participantes</div>
                <div class="d-flex align-center mt-1">
                  <v-icon size="16" class="mr-1">mdi-account-group</v-icon>
                  <span class="text-body-2 font-weight-medium">{{ torneio.total_participantes }}</span>
                </div>
              </v-col>

              <v-col v-if="torneio.minha_participacao" cols="6" class="mt-2">
                <div class="text-caption text-medium-emphasis">O teu estado</div>
                <v-chip
                  :color="participacaoConfig[torneio.minha_participacao.status_inscricao].color"
                  size="x-small"
                  class="mt-1"
                >
                  <v-icon start size="12">
                    {{ participacaoConfig[torneio.minha_participacao.status_inscricao].icon }}
                  </v-icon>
                  {{ participacaoConfig[torneio.minha_participacao.status_inscricao].label }}
                </v-chip>
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />

          <!-- Ações -->
          <v-card-actions class="pa-4 gap-2">

            <!-- Botão gerir — admin vê sempre -->
            <v-btn
              v-if="isAdmin"
              color="secondary"
              variant="tonal"
              prepend-icon="mdi-cog"
              :to="`/torneio/${torneio.id}`"
            >
              Gerir
            </v-btn>

            <!-- Já inscrito (qualquer utilizador) -->
            <template v-if="torneio.minha_participacao">
              <v-btn
                variant="tonal"
                :color="statusConfig[torneio.status].color"
                prepend-icon="mdi-play"
                class="flex-grow-1"
                :to="`/torneio/${torneio.id}`"
              >
                {{ torneio.status === 'LOBBY' ? 'Ver Lobby' : 'Entrar no Jogo' }}
              </v-btn>
            </template>

            <!-- Pode inscrever-se em LOBBY (admin ou não) — escolhe Jogar ou Plateia -->
            <template v-else-if="torneio.status === 'LOBBY'">
              <v-btn
                color="primary"
                prepend-icon="mdi-sword-cross"
                class="flex-grow-1"
                :loading="inscrevendo === torneio.id"
                @click="entrarNoTorneio(torneio, 'QUER_JOGAR')"
              >
                Jogar
              </v-btn>
              <v-btn
                variant="tonal"
                color="primary"
                prepend-icon="mdi-eye-outline"
                :loading="inscrevendo === torneio.id"
                @click="entrarNoTorneio(torneio, 'PLATEIA')"
              >
                Plateia
              </v-btn>
            </template>

            <!-- Torneio em curso sem participação -->
            <template v-else-if="!isAdmin">
              <v-btn
                variant="tonal"
                color="surface-variant"
                prepend-icon="mdi-eye-outline"
                block
                :to="`/torneio/${torneio.id}`"
              >
                Assistir
              </v-btn>
            </template>

          </v-card-actions>

        </v-card>
      </v-col>
    </v-row>

    <!-- Snackbar de erro — v-model usa boolean separado, não a string -->
    <v-snackbar v-model="mostrarErro" color="error" timeout="4000">
      {{ mensagemErro }}
      <template #actions>
        <v-btn variant="text" @click="mostrarErro = false">Fechar</v-btn>
      </template>
    </v-snackbar>

  </v-container>
</template>
