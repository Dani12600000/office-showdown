<script setup lang="ts">
import { JOGOS_CATALOGO, NOME_RONDA, type JogoTipo, type NumeroRonda } from '~/types/torneio'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const torneioId = route.params.id as string

const { isAdmin, perfil } = useAuth()
const {
  torneio, loading, participantes,
  confirmados, pendentes, plateia,
  podeIniciar, maxJogadores, confirmadosCheios, jogoAtual, faseAtual,
  jogosRonda, jogoTipoDe, numRondas,
  partidasRonda, minhaPartida, rondaTerminada, perfilDe,
  partidaDestaque, destacarPartida, destacarAleatoria,
  carregarLobby,
  confirmarJogador, moverParaPlateia, colocarPendente, adicionarBot,
  definirMax, definirJogoRonda, definirPreferencia, preencherAteMax, sortearElenco,
  iniciarTorneio, comecarJogos, avancarRonda,
} = useLobby(torneioId)

// Catálogo de jogos para o seletor por ronda
const itensJogos = (Object.keys(JOGOS_CATALOGO) as JogoTipo[]).map(k => ({
  value: k,
  title: JOGOS_CATALOGO[k].nome + (JOGOS_CATALOGO[k].disponivel ? '' : ' (em breve)'),
  props: { disabled: !JOGOS_CATALOGO[k].disponivel, prependIcon: JOGOS_CATALOGO[k].icon },
}))
const rondas = computed(() => Array.from({ length: numRondas.value }, (_, i) => i + 1))

async function escolherJogo(ronda: number, tipo: JogoTipo) {
  try { await definirJogoRonda(ronda, tipo) }
  catch (e: any) { mensagemErro.value = e.message; mostrarErro.value = true }
}

const opcoesMax = [2, 4, 8, 16]

// Modo personificação no lobby: ?como=<utilizadorId> → vista de escolha do jogador
const comoLobbyId = computed(() => (route.query.como as string) || null)
const comoParticipante = computed(() =>
  comoLobbyId.value
    ? participantes.value.find(p => p.utilizador_id === comoLobbyId.value) ?? null
    : null
)
const aEscolher = ref(false)
async function escolherLobby(pref: 'JOGAR' | 'PLATEIA') {
  if (!comoParticipante.value) return
  aEscolher.value = true
  try {
    await definirPreferencia(comoParticipante.value.id, pref)
  } catch (e: any) {
    mensagemErro.value = e.message; mostrarErro.value = true
  } finally {
    aEscolher.value = false
  }
}

function comErro(fn: () => Promise<void>) {
  return async () => {
    try { await fn() }
    catch (e: any) { mensagemErro.value = e.message; mostrarErro.value = true }
  }
}
const mudarMax = (n: number) => comErro(() => definirMax(n))()
const fazerPreencher = comErro(preencherAteMax)
const fazerSortear = comErro(sortearElenco)

async function apresentar(partidaId: string) {
  try { await destacarPartida(partidaId) }
  catch (e: any) { mensagemErro.value = e.message; mostrarErro.value = true }
}
async function apresentarAleatoria() {
  try { await destacarAleatoria() }
  catch (e: any) { mensagemErro.value = e.message; mostrarErro.value = true }
}

const aAdicionarBot = ref(false)
async function novoBot() {
  aAdicionarBot.value = true
  try { await adicionarBot() }
  catch (e: any) { mensagemErro.value = e.message; mostrarErro.value = true }
  finally { aAdicionarBot.value = false }
}

await carregarLobby()
if (!torneio.value) await navigateTo('/')

// Estado do torneio para decidir a vista
const emLobby = computed(() => torneio.value?.status === 'LOBBY')
const aJogar = computed(() => torneio.value?.status === 'JOGO' || torneio.value?.status === 'ARVORE')
const naArvore = computed(() => torneio.value?.status === 'ARVORE')
const emJogo = computed(() => torneio.value?.status === 'JOGO')

// Há uma partida no palco ainda a decorrer → não deixar trocar a apresentação
const destaqueEmJogo = computed(() => partidaDestaque.value?.status === 'A_JOGAR')

const aComecar = ref(false)
async function comecar() {
  aComecar.value = true
  try { await comecarJogos() }
  catch (e: any) { mensagemErro.value = e.message; mostrarErro.value = true }
  finally { aComecar.value = false }
}
const terminado = computed(() => torneio.value?.status === 'FINAL')
const campeao = computed(() => perfilDe(torneio.value?.vencedor_id ?? null))

// Todos os bots do lobby (para personificar a escolha jogar/plateia)
const botsLobby = computed(() =>
  participantes.value.filter(p => p.utilizador?.is_bot)
)

// Cada bot em partida ativa (para controlar individualmente, um por janela)
const botsParaControlar = computed(() => {
  const out: { bot: NonNullable<ReturnType<typeof perfilDe>>; partidaId: string; adversario: string }[] = []
  for (const p of partidasRonda.value) {
    if (p.status !== 'A_JOGAR') continue
    const b1 = perfilDe(p.jogador1_id)
    const b2 = perfilDe(p.jogador2_id)
    if (b1?.is_bot) out.push({ bot: b1, partidaId: p.id, adversario: b2?.name ?? '—' })
    if (b2?.is_bot) out.push({ bot: b2, partidaId: p.id, adversario: b1?.name ?? '—' })
  }
  return out
})

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

  <!-- ===== MODO PERSONIFICAÇÃO NO LOBBY (vista do jogador) ===== -->
  <v-container v-else-if="torneio && comoParticipante" max-width="520" class="py-10">
    <div v-motion-fade class="text-center mb-8">
      <v-avatar size="96" color="primary" class="mb-3" style="outline:3px solid rgba(0,229,255,0.5); outline-offset:3px">
        <v-img v-if="comoParticipante.utilizador?.avatar_url" :src="comoParticipante.utilizador.avatar_url" cover />
        <span v-else class="text-h4 font-weight-black text-surface">{{ comoParticipante.utilizador?.name?.charAt(0).toUpperCase() }}</span>
      </v-avatar>
      <h2 class="text-h5 font-weight-black">Olá, {{ comoParticipante.utilizador?.name }}!</h2>
      <p class="text-body-2 text-medium-emphasis mt-1">{{ torneio.nome }} — o que preferes?</p>
    </div>

    <v-row dense>
      <v-col cols="12" sm="6">
        <v-card
          rounded="xl"
          :variant="comoParticipante.preferencia === 'JOGAR' ? 'flat' : 'tonal'"
          :color="comoParticipante.preferencia === 'JOGAR' ? 'primary' : undefined"
          class="escolha-lobby"
          @click="escolherLobby('JOGAR')"
        >
          <v-card-text class="text-center pa-6">
            <v-icon size="48" class="mb-2">mdi-sword-cross</v-icon>
            <div class="text-h6 font-weight-bold">Quero jogar</div>
            <div class="text-caption">Quero entrar na competição</div>
            <v-icon v-if="comoParticipante.preferencia === 'JOGAR'" class="mt-2">mdi-check-circle</v-icon>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6">
        <v-card
          rounded="xl"
          :variant="comoParticipante.preferencia === 'PLATEIA' ? 'flat' : 'tonal'"
          :color="comoParticipante.preferencia === 'PLATEIA' ? 'primary' : undefined"
          class="escolha-lobby"
          @click="escolherLobby('PLATEIA')"
        >
          <v-card-text class="text-center pa-6">
            <v-icon size="48" class="mb-2">mdi-eye</v-icon>
            <div class="text-h6 font-weight-bold">Prefiro a plateia</div>
            <div class="text-caption">Quero assistir e apostar</div>
            <v-icon v-if="comoParticipante.preferencia === 'PLATEIA'" class="mt-2">mdi-check-circle</v-icon>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-progress-linear v-if="aEscolher" indeterminate color="primary" class="mt-4" rounded />

    <p class="text-center text-caption text-medium-emphasis mt-6">
      <v-icon size="14" start>mdi-information-outline</v-icon>
      Isto é só a preferência. Quem decide quem joga é o sorteio ou o admin.
    </p>

    <v-snackbar v-model="mostrarErro" color="error" timeout="5000">{{ mensagemErro }}</v-snackbar>
  </v-container>

  <template v-else-if="torneio">
    <v-container max-width="960" class="py-6">

      <!-- Voltar + Projetor -->
      <div class="d-flex align-center justify-space-between mb-5">
        <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" to="/" class="text-medium-emphasis px-1">
          Voltar
        </v-btn>
        <v-btn
          v-if="isAdmin"
          variant="tonal" color="primary" size="small" rounded="lg"
          prepend-icon="mdi-television-play"
          append-icon="mdi-open-in-new"
          :href="`/torneio/${torneioId}/projetor`"
          target="_blank"
        >
          Projetor
        </v-btn>
      </div>

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
                  <div class="text-h4 font-weight-black text-success">{{ confirmados.length }}<span class="text-medium-emphasis" style="font-size:1.2rem"> / {{ maxJogadores }}</span></div>
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

          <template v-if="isAdmin">
            <!-- Máximo de jogadores -->
            <div class="d-flex align-center flex-wrap ga-3 mb-4">
              <span class="text-body-2 text-medium-emphasis">Máximo de jogadores:</span>
              <v-chip-group
                :model-value="maxJogadores"
                mandatory
                selected-class="text-secondary"
                @update:model-value="mudarMax"
              >
                <v-chip
                  v-for="n in opcoesMax" :key="n"
                  :value="n" filter variant="tonal" size="small"
                >
                  {{ n }}
                </v-chip>
              </v-chip-group>
            </div>

            <!-- Jogo de cada ronda -->
            <v-card rounded="xl" variant="tonal" class="mb-4">
              <v-card-text class="pa-4">
                <div class="d-flex align-center gap-2 mb-3">
                  <v-icon size="18" color="primary">mdi-gamepad-variant</v-icon>
                  <span class="text-body-2 font-weight-bold">Jogo de cada ronda</span>
                </div>
                <v-row dense>
                  <v-col v-for="r in rondas" :key="r" cols="12" sm="6">
                    <v-select
                      :model-value="jogosRonda[String(r)] ?? 'PPT'"
                      :items="itensJogos"
                      item-props
                      :label="`Ronda ${r} · ${NOME_RONDA[r as NumeroRonda] ?? ''}`"
                      variant="outlined"
                      density="compact"
                      hide-details
                      @update:model-value="(v) => escolherJogo(r, v as JogoTipo)"
                    >
                      <template #prepend-inner>
                        <v-icon size="18">{{ JOGOS_CATALOGO[(jogosRonda[String(r)] ?? 'PPT') as JogoTipo].icon }}</v-icon>
                      </template>
                    </v-select>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <!-- Ferramentas de elenco -->
            <div class="d-flex align-center flex-wrap ga-2 mb-3">
              <v-btn
                variant="tonal" rounded="lg" size="small"
                prepend-icon="mdi-robot"
                :loading="aAdicionarBot"
                @click="novoBot"
              >
                Adicionar bot
              </v-btn>
              <v-btn
                variant="tonal" color="success" rounded="lg" size="small"
                prepend-icon="mdi-account-multiple-plus"
                @click="fazerPreencher"
              >
                Preencher até ao máximo
              </v-btn>
              <v-btn
                variant="tonal" color="primary" rounded="lg" size="small"
                prepend-icon="mdi-shuffle-variant"
                @click="fazerSortear"
              >
                Sortear elenco
              </v-btn>
            </div>

            <!-- Iniciar -->
            <div class="d-flex align-center justify-space-between flex-wrap ga-3">
              <v-alert
                v-if="!podeIniciar"
                type="info" variant="tonal" density="compact"
                icon="mdi-information-outline"
                class="flex-grow-1"
                style="max-width:460px"
              >
                {{ confirmados.length > maxJogadores
                    ? `Tens ${confirmados.length} confirmados — o máximo é ${maxJogadores}. Usa "Sortear elenco".`
                    : 'Mínimo 2 jogadores confirmados para iniciar.' }}
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
        </template>

        <!-- ===== REVELAÇÃO DOS CONFRONTOS (ARVORE, admin) ===== -->
        <div v-else-if="naArvore && isAdmin" class="d-flex align-center justify-space-between flex-wrap ga-3 mb-2">
          <v-alert type="info" variant="tonal" density="compact" icon="mdi-tournament" class="flex-grow-1" style="max-width:460px">
            Os confrontos estão revelados! Mostra-os no projetor e começa quando quiseres.
          </v-alert>
          <v-btn
            color="secondary" size="large" rounded="lg"
            prepend-icon="mdi-play-circle"
            :loading="aComecar"
            @click="comecar"
          >
            Começar jogos
          </v-btn>
        </div>

        <!-- ===== CONTROLOS (JOGO, admin) ===== -->
        <div v-else-if="emJogo && isAdmin" class="d-flex align-center justify-end flex-wrap gap-2 mb-2">
          <v-btn
            variant="tonal" color="primary" rounded="lg"
            prepend-icon="mdi-shuffle-variant"
            :disabled="destaqueEmJogo"
            :title="destaqueEmJogo ? 'Há uma partida no palco — termina-a primeiro' : ''"
            @click="apresentarAleatoria"
          >
            Projetar aleatória
          </v-btn>
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
        :is-admin="isAdmin"
        :destaque-id="partidaDestaque?.id ?? null"
        :bloquear-troca="destaqueEmJogo"
        :perfil-de="perfilDe"
        @destacar="apresentar"
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
                    <v-chip v-if="p.utilizador?.is_bot" size="x-small" variant="tonal" color="surface-variant">
                      <v-icon start size="11">mdi-robot</v-icon>BOT
                    </v-chip>
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
                    <v-chip v-if="p.utilizador?.is_bot" size="x-small" variant="tonal" color="surface-variant">
                      <v-icon start size="11">mdi-robot</v-icon>BOT
                    </v-chip>
                  </div>
                  <div class="text-caption text-medium-emphasis d-flex align-center gap-1">
                    @{{ p.utilizador?.username }}
                    <span class="mx-1">·</span>
                    <v-icon size="12" :color="p.preferencia === 'PLATEIA' ? 'primary' : 'success'">
                      {{ p.preferencia === 'PLATEIA' ? 'mdi-eye' : 'mdi-sword-cross' }}
                    </v-icon>
                    prefere {{ p.preferencia === 'PLATEIA' ? 'plateia' : 'jogar' }}
                  </div>
                </div>
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

    <!-- ===== FAB: PAINEL DE CONTROLO DE BOTS (admin, a jogar) ===== -->
    <v-menu
      v-if="isAdmin && emJogo"
      location="top end"
      :close-on-content-click="false"
      offset="12"
    >
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          icon="mdi-robot"
          color="secondary"
          size="large"
          elevation="8"
          class="fab-bots"
        />
      </template>

      <v-card rounded="xl" min-width="300" max-width="360" elevation="12">
        <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center gap-2 pa-4 pb-2">
          <v-icon size="20" color="secondary">mdi-robot</v-icon>
          Controlar bots
        </v-card-title>
        <v-card-subtitle class="px-4 pb-2" style="white-space:normal">
          Cada bot abre numa janela nova, como se fosses esse jogador.
        </v-card-subtitle>
        <v-divider />

        <v-list density="compact" nav>
          <v-list-item
            v-for="b in botsParaControlar"
            :key="b.bot.id"
            :href="`/torneio/${torneioId}/partida/${b.partidaId}?como=${b.bot.id}`"
            target="_blank"
            rounded="lg"
            append-icon="mdi-open-in-new"
          >
            <template #prepend>
              <v-avatar size="32" color="surface-variant" class="mr-1">
                <v-img v-if="b.bot.avatar_url" :src="b.bot.avatar_url" cover />
                <v-icon v-else size="18">mdi-robot</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2 font-weight-medium">{{ b.bot.name }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">vs {{ b.adversario }}</v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-if="!botsParaControlar.length">
            <v-list-item-title class="text-caption text-medium-emphasis">
              Nenhum bot em partida nesta ronda.
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>

    <!-- ===== FAB: PERSONIFICAR BOTS NO LOBBY (admin) ===== -->
    <v-menu
      v-if="isAdmin && emLobby"
      location="top end"
      :close-on-content-click="false"
      offset="12"
    >
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          icon="mdi-robot"
          color="secondary"
          size="large"
          elevation="8"
          class="fab-bots"
        />
      </template>

      <v-card rounded="xl" min-width="300" max-width="360" elevation="12">
        <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center gap-2 pa-4 pb-2">
          <v-icon size="20" color="secondary">mdi-robot</v-icon>
          Personificar bots
        </v-card-title>
        <v-card-subtitle class="px-4 pb-2" style="white-space:normal">
          Abre cada bot numa janela nova para escolheres jogar ou plateia, como se fosses ele.
        </v-card-subtitle>
        <v-divider />

        <v-list density="compact" nav>
          <v-list-item
            v-for="b in botsLobby" :key="b.id"
            :href="`/torneio/${torneioId}?como=${b.utilizador_id}`"
            target="_blank"
            rounded="lg"
            append-icon="mdi-open-in-new"
          >
            <template #prepend>
              <v-avatar size="32" color="surface-variant" class="mr-1">
                <v-img v-if="b.utilizador?.avatar_url" :src="b.utilizador.avatar_url" cover />
                <v-icon v-else size="18">mdi-robot</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2 font-weight-medium">{{ b.utilizador?.name }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              Prefere: {{ b.preferencia === 'PLATEIA' ? 'plateia' : 'jogar' }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-if="!botsLobby.length">
            <v-list-item-title class="text-caption text-medium-emphasis">
              Ainda não há bots. Usa "Adicionar bot".
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>

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

.fab-bots {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}

.escolha-lobby {
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.1);
  transition: transform 0.15s, border-color 0.15s;
}
.escolha-lobby:hover {
  transform: translateY(-4px);
  border-color: rgb(var(--v-theme-primary));
}

.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }

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
