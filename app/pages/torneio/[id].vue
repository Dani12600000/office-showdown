<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const torneioId = route.params.id as string

const { isAdmin, perfil } = useAuth()
const {
  torneio, loading, participantes,
  confirmados, pendentes, plateia,
  podeIniciar, jogoAtual, faseAtual,
  partidasRonda, minhaPartida, rondaTerminada, perfilDe,
  carregarLobby,
  confirmarJogador, moverParaPlateia, colocarPendente,
  iniciarTorneio, avancarRonda,
} = useLobby(torneioId)

await carregarLobby()
if (!torneio.value) await navigateTo('/')

// Estado do torneio para decidir a vista
const emLobby = computed(() => torneio.value?.status === 'LOBBY')
const aJogar = computed(() => torneio.value?.status === 'JOGO' || torneio.value?.status === 'ARVORE')
const terminado = computed(() => torneio.value?.status === 'FINAL')
const campeao = computed(() => perfilDe(torneio.value?.vencedor_id ?? null))

// Avançar ronda (admin)
const aAvancar = ref(false)
async function fazerAvancar() {
  aAvancar.value = true
  try { await avancarRonda() }
  catch (e: any) { mensagemErro.value = e.message; mostrarErro.value = true }
  finally { aAvancar.value = false }
}

const emAcao = ref<string | null>(null)
const mostrarErro = ref(false)
const mensagemErro = ref('')

async function acao(id: string, fn: (id: string) => Promise<void>) {
  emAcao.value = id
  try {
    await fn(id)
  } catch (e: any) {
    mensagemErro.value = e.message
    mostrarErro.value = true
  } finally {
    emAcao.value = null
  }
}

const aIniciar = ref(false)
const dialogIniciar = ref(false)
async function confirmarIniciar() {
  aIniciar.value = true
  try { await iniciarTorneio(); dialogIniciar.value = false }
  finally { aIniciar.value = false }
}
</script>

<template>
  <div v-if="loading" class="d-flex justify-center align-center" style="min-height:60vh">
    <v-progress-circular indeterminate color="primary" size="56" />
  </div>

  <template v-else-if="torneio">
    <v-container max-width="960" class="py-6">

      <!-- Voltar -->
      <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" to="/" class="mb-5 text-medium-emphasis px-1">
        Voltar
      </v-btn>

      <!-- ===== CABEÇALHO ===== -->
      <div class="mb-6">
        <h1 class="text-h3 font-weight-black mb-3">{{ torneio.nome }}</h1>

        <div class="d-flex flex-wrap gap-2 mb-5">
          <v-chip v-if="emLobby" color="success" size="small" label>
            <v-icon start size="14">mdi-door-open</v-icon>Lobby aberto
          </v-chip>
          <v-chip v-else-if="aJogar" color="secondary" size="small" label>
            <v-icon start size="14">mdi-sword-cross</v-icon>A decorrer
          </v-chip>
          <v-chip v-else color="accent" size="small" label>
            <v-icon start size="14">mdi-trophy</v-icon>Terminado
          </v-chip>
          <v-chip size="small" variant="tonal" color="primary">
            <v-icon start size="14">mdi-controller-classic</v-icon>{{ jogoAtual }}
          </v-chip>
          <v-chip size="small" variant="tonal">
            <v-icon start size="14">mdi-tournament</v-icon>{{ faseAtual }}
          </v-chip>
        </div>

        <!-- ===== STATS + INICIAR (só no LOBBY) ===== -->
        <template v-if="emLobby">
          <v-card rounded="xl" elevation="0" class="stats-card mb-5">
            <v-card-text class="pa-0">
              <v-row no-gutters>
                <v-col class="stat-col text-center pa-4">
                  <div class="text-h4 font-weight-black text-success">{{ confirmados.length }}</div>
                  <div class="text-caption text-medium-emphasis mt-1">Confirmados</div>
                </v-col>
                <v-divider vertical />
                <v-col class="stat-col text-center pa-4">
                  <div class="text-h4 font-weight-black text-warning">{{ pendentes.length }}</div>
                  <div class="text-caption text-medium-emphasis mt-1">A aguardar</div>
                </v-col>
                <v-divider vertical />
                <v-col class="stat-col text-center pa-4">
                  <div class="text-h4 font-weight-black text-primary">{{ plateia.length }}</div>
                  <div class="text-caption text-medium-emphasis mt-1">Plateia</div>
                </v-col>
                <v-divider vertical />
                <v-col class="stat-col text-center pa-4">
                  <div class="text-h4 font-weight-black">
                    {{ confirmados.length + pendentes.length + plateia.length }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">Total</div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <div v-if="isAdmin" class="d-flex align-center justify-space-between flex-wrap gap-3">
            <v-alert
              v-if="!podeIniciar"
              type="info" variant="tonal" density="compact"
              icon="mdi-information-outline"
              class="flex-grow-1"
              style="max-width:460px"
            >
              Mínimo 2 jogadores confirmados para iniciar.
            </v-alert>
            <v-spacer v-else />
            <v-btn
              color="secondary" size="large" rounded="lg"
              prepend-icon="mdi-play-circle"
              :disabled="!podeIniciar"
              @click="dialogIniciar = true"
            >
              Iniciar Torneio
              <v-chip class="ml-2" size="x-small" color="white" text-color="secondary">
                {{ confirmados.length }}
              </v-chip>
            </v-btn>
          </div>
        </template>

        <!-- ===== BOTÃO AVANÇAR RONDA (admin, a jogar) ===== -->
        <div v-else-if="aJogar && isAdmin" class="d-flex align-center justify-end mb-2">
          <v-btn
            color="secondary" rounded="lg"
            prepend-icon="mdi-skip-next"
            :disabled="!rondaTerminada"
            :loading="aAvancar"
            @click="fazerAvancar"
          >
            Avançar ronda
          </v-btn>
        </div>
      </div>

      <!-- ===== VISTA: CAMPEÃO ===== -->
      <div v-if="terminado" class="text-center py-10">
        <v-icon size="80" color="accent" class="mb-4">mdi-trophy</v-icon>
        <p class="text-overline text-medium-emphasis">Campeão do torneio</p>
        <v-avatar size="120" color="primary" class="my-4 champion-glow">
          <v-img v-if="campeao?.avatar_url" :src="campeao.avatar_url" cover />
          <span v-else class="text-h3 font-weight-black text-surface">
            {{ campeao?.name?.charAt(0).toUpperCase() }}
          </span>
        </v-avatar>
        <h2 class="text-h4 font-weight-black">{{ campeao?.name }}</h2>
      </div>

      <!-- ===== VISTA: BRACKET (a jogar) ===== -->
      <TorneioBracket
        v-else-if="aJogar"
        :torneio-id="torneioId"
        :partidas="partidasRonda"
        :fase-atual="faseAtual"
        :jogo-atual="jogoAtual"
        :perfil-id="perfil?.id"
        :perfil-de="perfilDe"
      />

      <!-- ===== VISTA: GRID DO LOBBY ===== -->
      <v-row v-else>

        <!-- CONFIRMADOS -->
        <v-col cols="12" md="5">
          <div class="d-flex align-center gap-2 mb-3">
            <span class="dot dot--success mr-2" />
            <span class="text-subtitle-1 font-weight-bold">Jogadores confirmados</span>
            <v-spacer />
            <v-chip color="success" variant="tonal" size="small">{{ confirmados.length }}</v-chip>
          </div>

          <TransitionGroup name="lista">
            <v-card
              v-for="p in confirmados" :key="p.id"
              rounded="xl" elevation="0"
              class="player-card player-card--success mb-2"
              :class="{ 'player-card--me': p.utilizador_id === perfil?.id }"
            >
              <v-card-text class="pa-3 d-flex align-center gap-3">
                <v-avatar size="44" color="primary" class="ring-success flex-shrink-0">
                  <v-img v-if="p.utilizador?.avatar_url" :src="p.utilizador.avatar_url" cover />
                  <span v-else class="text-body-1 font-weight-black text-surface">
                    {{ p.utilizador?.name?.charAt(0).toUpperCase() }}
                  </span>
                </v-avatar>
                <div class="flex-grow-1 overflow-hidden">
                  <div class="text-body-2 font-weight-bold d-flex align-center gap-1">
                    <span class="text-truncate">{{ p.utilizador?.name }}</span>
                    <v-chip v-if="p.utilizador_id === perfil?.id" size="x-small" color="primary">Tu</v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis">@{{ p.utilizador?.username }}</div>
                </div>
                <template v-if="isAdmin">
                  <v-btn icon="mdi-undo" size="x-small" variant="text" color="warning" :loading="emAcao === p.id" title="Devolver a pendentes" @click="acao(p.id, colocarPendente)" />
                  <v-btn icon="mdi-eye-outline" size="x-small" variant="text" color="primary" :loading="emAcao === p.id" title="Mover para plateia" @click="acao(p.id, moverParaPlateia)" />
                </template>
              </v-card-text>
            </v-card>
          </TransitionGroup>

          <div v-if="!confirmados.length" class="text-center py-10">
            <v-icon size="44" color="surface-variant">mdi-account-check-outline</v-icon>
            <p class="text-body-2 text-medium-emphasis mt-2">Nenhum jogador confirmado ainda.</p>
          </div>
        </v-col>

        <!-- A AGUARDAR + PLATEIA -->
        <v-col cols="12" md="7">

          <!-- A aguardar -->
          <div class="d-flex align-center gap-2 mb-3">
            <span class="dot dot--warning mr-2" />
            <span class="text-subtitle-1 font-weight-bold">A aguardar</span>
            <v-spacer />
            <v-chip color="warning" variant="tonal" size="small">{{ pendentes.length }}</v-chip>
          </div>

          <TransitionGroup name="lista">
            <v-card
              v-for="p in pendentes" :key="p.id"
              rounded="xl" elevation="0"
              class="player-card player-card--warning mb-2"
              :class="{ 'player-card--me': p.utilizador_id === perfil?.id }"
            >
              <v-card-text class="pa-3 d-flex align-center gap-3">
                <v-avatar size="40" color="surface-variant" class="flex-shrink-0">
                  <v-img v-if="p.utilizador?.avatar_url" :src="p.utilizador.avatar_url" cover />
                  <span v-else class="text-caption font-weight-bold">
                    {{ p.utilizador?.name?.charAt(0).toUpperCase() }}
                  </span>
                </v-avatar>
                <div class="flex-grow-1 overflow-hidden">
                  <div class="text-body-2 font-weight-medium d-flex align-center gap-1">
                    <span class="text-truncate">{{ p.utilizador?.name }}</span>
                    <v-chip v-if="p.utilizador_id === perfil?.id" size="x-small" color="warning">Tu</v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis">@{{ p.utilizador?.username }}</div>
                </div>
                <template v-if="isAdmin">
                  <v-btn color="success" variant="tonal" size="x-small" rounded="lg" prepend-icon="mdi-check" :loading="emAcao === p.id" @click="acao(p.id, confirmarJogador)">
                    Confirmar
                  </v-btn>
                  <v-btn icon="mdi-eye-outline" size="x-small" variant="text" color="primary" :loading="emAcao === p.id" @click="acao(p.id, moverParaPlateia)" />
                </template>
              </v-card-text>
            </v-card>
          </TransitionGroup>

          <div v-if="!pendentes.length" class="text-center py-8">
            <v-icon size="36" color="surface-variant">mdi-clock-outline</v-icon>
            <p class="text-body-2 text-medium-emphasis mt-2">Nenhum inscrito pendente.</p>
          </div>

          <!-- Plateia -->
          <div class="d-flex align-center gap-2 mt-5 mb-3">
            <span class="dot dot--primary mr-2" />
            <span class="text-subtitle-2 font-weight-bold">Plateia</span>
            <v-spacer />
            <v-chip color="primary" variant="tonal" size="small">{{ plateia.length }}</v-chip>
          </div>

          <div v-if="plateia.length" class="d-flex flex-wrap gap-2">
            <v-chip
              v-for="p in plateia" :key="p.id"
              :color="p.utilizador_id === perfil?.id ? 'primary' : undefined"
              variant="tonal" rounded="lg"
            >
              <v-avatar start size="22" color="primary">
                <v-img v-if="p.utilizador?.avatar_url" :src="p.utilizador.avatar_url" cover />
                <span v-else style="font-size:9px;font-weight:800">{{ p.utilizador?.name?.charAt(0).toUpperCase() }}</span>
              </v-avatar>
              {{ p.utilizador?.name }}
              <v-icon v-if="isAdmin" end size="13" class="cursor-pointer" @click="acao(p.id, colocarPendente)">mdi-undo</v-icon>
            </v-chip>
          </div>
          <p v-else class="text-body-2 text-medium-emphasis py-2">Nenhum espectador ainda.</p>

        </v-col>
      </v-row>
    </v-container>

    <!-- Dialog iniciar -->
    <v-dialog v-model="dialogIniciar" max-width="380">
      <v-card rounded="xl">
        <v-card-text class="pa-8 text-center">
          <v-icon size="60" color="secondary" class="mb-4">mdi-play-circle-outline</v-icon>
          <h3 class="text-h6 font-weight-bold mb-2">Iniciar o torneio?</h3>
          <p class="text-body-2 text-medium-emphasis">
            Vai começar com <strong class="text-white">{{ confirmados.length }} jogadores</strong>.
            Esta ação não pode ser desfeita.
          </p>
        </v-card-text>
        <v-card-actions class="px-6 pb-6 pt-0 gap-3">
          <v-btn variant="text" flex-grow-1 @click="dialogIniciar = false">Cancelar</v-btn>
          <v-btn color="secondary" flex-grow-1 :loading="aIniciar" prepend-icon="mdi-play-circle" @click="confirmarIniciar">
            Vamos lá!
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar de erro -->
    <v-snackbar v-model="mostrarErro" color="error" timeout="5000">
      {{ mensagemErro }}
      <template #actions>
        <v-btn variant="text" @click="mostrarErro = false">Fechar</v-btn>
      </template>
    </v-snackbar>

  </template>
</template>

<style scoped>
.stats-card {
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.champion-glow {
  box-shadow: 0 0 40px rgba(255, 214, 0, 0.6);
  outline: 3px solid rgb(var(--v-theme-accent));
  outline-offset: 3px;
}

.dot--success { background: rgb(var(--v-theme-success)); }
.dot--warning { background: rgb(var(--v-theme-warning)); }
.dot--primary { background: rgb(var(--v-theme-primary)); }

.player-card {
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
  transition: background 0.15s;
}
.player-card:hover { background: rgba(255,255,255,0.05); }
.player-card--success { border-color: rgba(0,230,118,0.2); }
.player-card--warning { border-color: rgba(255,171,0,0.2); }
.player-card--me {
  border-color: rgba(0,229,255,0.4) !important;
  background: rgba(0,229,255,0.04) !important;
}

.ring-success {
  outline: 2px solid rgba(0,230,118,0.5);
  outline-offset: 2px;
}

.lista-enter-active, .lista-leave-active { transition: all 0.25s ease; }
.lista-enter-from { opacity: 0; transform: translateY(-6px); }
.lista-leave-to   { opacity: 0; transform: translateX(12px); }
</style>
