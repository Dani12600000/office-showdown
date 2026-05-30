<script setup lang="ts">
import confetti from 'canvas-confetti'

definePageMeta({ layout: 'projetor', middleware: 'auth' })

const route = useRoute()
const torneioId = route.params.id as string

// URL para o QR — leva ao registo/entrada (origem do site)
const url = useRequestURL()
const urlEntrada = computed(() => `${url.origin}/signup`)

const {
  torneio, loading,
  participantes, partidasRonda, perfilDe, partidaDestaque,
  faseAtual, jogoAtual, jogoTipoDe,
  carregarLobby,
} = useLobby(torneioId)

await carregarLobby()

const emLobby   = computed(() => torneio.value?.status === 'LOBBY')
const naArvore  = computed(() => torneio.value?.status === 'ARVORE')
const emJogo    = computed(() => torneio.value?.status === 'JOGO')
const terminado = computed(() => torneio.value?.status === 'FINAL')
const campeao   = computed(() => perfilDe(torneio.value?.vencedor_id ?? null))

// ---- Partida em destaque ----
const dest = computed(() => partidaDestaque.value)
const j1 = computed(() => perfilDe(dest.value?.jogador1_id ?? null))
const j2 = computed(() => perfilDe(dest.value?.jogador2_id ?? null))
const jogoDestTipo = computed(() => dest.value ? jogoTipoDe(dest.value.ronda) : 'PPT')

const inicial = (id: string | null) => perfilDe(id)?.name?.charAt(0).toUpperCase() ?? '?'

// ---- Confetti (campeão) ----
let timer: ReturnType<typeof setInterval> | null = null
watch(terminado, (fim) => {
  if (fim) {
    confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } })
    timer = setInterval(() => {
      confetti({ particleCount: 80, angle: 60, spread: 80, origin: { x: 0 } })
      confetti({ particleCount: 80, angle: 120, spread: 80, origin: { x: 1 } })
    }, 1800)
  } else if (timer) { clearInterval(timer); timer = null }
}, { immediate: true })

onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div v-if="loading" class="d-flex justify-center align-center" style="min-height:100vh">
    <v-progress-circular indeterminate color="primary" size="72" />
  </div>

  <div v-else-if="torneio" class="pa-8">

    <!-- ===== CABEÇALHO ===== -->
    <div class="d-flex align-center justify-space-between mb-6">
      <LogoShowdown />
      <div class="text-right">
        <h1 class="text-h3 font-weight-black">{{ torneio.nome }}</h1>
        <div class="d-flex gap-2 justify-end mt-2">
          <v-chip size="large" variant="tonal" color="primary">
            <v-icon start>mdi-controller-classic</v-icon>{{ jogoAtual }}
          </v-chip>
          <v-chip size="large" color="accent" variant="flat">
            <v-icon start>mdi-tournament</v-icon>{{ faseAtual }}
          </v-chip>
        </div>
      </div>
    </div>

    <!-- ===== CAMPEÃO ===== -->
    <div v-if="terminado" class="text-center py-10">
      <p class="text-overline text-medium-emphasis" style="font-size:1.2rem !important">Campeão</p>
      <v-avatar size="240" color="primary" class="champion-glow my-6">
        <v-img v-if="campeao?.avatar_url" :src="campeao.avatar_url" cover />
        <span v-else class="font-weight-black text-surface" style="font-size:6rem">{{ campeao?.name?.charAt(0).toUpperCase() }}</span>
      </v-avatar>
      <h1 class="font-weight-black" style="font-size:5rem; line-height:1">{{ campeao?.name }}</h1>
      <v-icon size="64" color="accent" class="mt-4">mdi-trophy</v-icon>
    </div>

    <!-- ===== LOBBY ===== -->
    <div v-else-if="emLobby" class="lobby-grid">
      <div class="qr-painel text-center">
        <p class="text-overline text-medium-emphasis mb-2" style="font-size:1rem !important">Entra no jogo</p>
        <QrCode :value="urlEntrada" :size="300" class="mx-auto" />
        <p class="text-h5 font-weight-bold mt-5">
          <v-icon color="primary" class="mr-1">mdi-cellphone</v-icon>
          Aponta a câmara do telemóvel
        </p>
        <p class="text-body-1 text-medium-emphasis mt-1">Regista-te e escolhe se queres jogar ou ficar na plateia.</p>
      </div>

      <div class="jogadores-painel">
        <div class="d-flex gap-2 mb-6 flex-wrap justify-center">
          <v-chip size="large" color="success">
            <v-icon start>mdi-door-open</v-icon>Inscrições abertas
          </v-chip>
          <v-chip size="large" variant="tonal" color="primary">
            <v-icon start>mdi-account-group</v-icon>{{ participantes.length }} dentro
          </v-chip>
        </div>
        <div class="jogadores-lobby">
          <div v-for="p in participantes" :key="p.id" class="text-center jogador-lobby">
            <v-avatar
              size="84"
              color="primary"
              class="player-avatar mb-2"
              :class="{
                'player-avatar--jogar':   p.status_inscricao === 'JOGADOR_CONFIRMADO',
                'player-avatar--plateia': p.status_inscricao === 'PLATEIA',
                'player-avatar--pending': p.status_inscricao === 'QUER_JOGAR',
              }"
            >
              <v-img v-if="p.utilizador?.avatar_url" :src="p.utilizador.avatar_url" cover />
              <span v-else class="text-h5 font-weight-black text-surface">{{ p.utilizador?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-subtitle-2 font-weight-bold d-flex align-center justify-center gap-1">
              <span>{{ p.utilizador?.name }}</span>
              <v-icon v-if="p.utilizador?.is_bot" size="14" class="text-medium-emphasis">mdi-robot</v-icon>
            </div>
            <div class="text-caption mt-1">
              <span v-if="p.status_inscricao === 'JOGADOR_CONFIRMADO'" class="text-success">
                <v-icon size="12">mdi-sword-cross</v-icon> vai jogar
              </span>
              <span v-else-if="p.status_inscricao === 'PLATEIA'" class="text-primary">
                <v-icon size="12">mdi-eye</v-icon> plateia
              </span>
              <span v-else class="text-medium-emphasis">
                <v-icon size="12">{{ p.preferencia === 'PLATEIA' ? 'mdi-eye-outline' : 'mdi-sword-cross' }}</v-icon>
                prefere {{ p.preferencia === 'PLATEIA' ? 'plateia' : 'jogar' }}
              </span>
            </div>
          </div>
          <div v-if="!participantes.length" class="text-h6 text-medium-emphasis py-8">À espera dos primeiros…</div>
        </div>
      </div>
    </div>

    <!-- ===== ARVORE ===== -->
    <div v-else-if="naArvore">
      <div v-motion-fade class="text-center mb-8">
        <v-chip size="large" color="secondary" class="font-weight-bold">
          <v-icon start>mdi-tournament</v-icon>Os confrontos · {{ faseAtual }}
        </v-chip>
      </div>
      <v-row justify="center">
        <v-col v-for="(p, i) in partidasRonda" :key="p.id" cols="12" md="6" lg="4">
          <div v-motion-slide-visible-bottom :delay="i * 120" class="confronto">
            <div class="text-center jogador-mini">
              <v-avatar size="84" class="ring-blue mb-2">
                <v-img v-if="perfilDe(p.jogador1_id)?.avatar_url" :src="perfilDe(p.jogador1_id)!.avatar_url!" cover />
                <span v-else class="text-h5 font-weight-black text-blue">{{ inicial(p.jogador1_id) }}</span>
              </v-avatar>
              <div class="text-body-1 font-weight-bold text-truncate">{{ perfilDe(p.jogador1_id)?.name ?? '—' }}</div>
            </div>
            <div class="vs-grande">VS</div>
            <div class="text-center jogador-mini">
              <v-avatar size="84" class="ring-red mb-2">
                <v-img v-if="perfilDe(p.jogador2_id)?.avatar_url" :src="perfilDe(p.jogador2_id)!.avatar_url!" cover />
                <span v-else class="text-h5 font-weight-black text-red">{{ p.jogador2_id ? inicial(p.jogador2_id) : '—' }}</span>
              </v-avatar>
              <div class="text-body-1 font-weight-bold text-truncate">{{ p.jogador2_id ? (perfilDe(p.jogador2_id)?.name ?? '—') : 'Bye' }}</div>
            </div>
          </div>
        </v-col>
      </v-row>
    </div>

    <!-- ===== A JOGAR: PARTIDA EM DESTAQUE ===== -->
    <template v-else-if="emJogo">
      <div v-if="dest">
        <JogoPPTProjetor    v-if="jogoDestTipo === 'PPT'"       :partida="dest" :jogador1="j1" :jogador2="j2" />
        <JogoGaloProjetor   v-else-if="jogoDestTipo === 'GALO'"   :partida="dest" :jogador1="j1" :jogador2="j2" />
        <JogoQuatroProjetor v-else-if="jogoDestTipo === 'QUATRO'" :partida="dest" :jogador1="j1" :jogador2="j2" />
        <div v-else class="text-center py-12">
          <v-icon size="80" color="surface-variant" class="mb-4">mdi-hammer-wrench</v-icon>
          <h2 class="text-h4 font-weight-bold">Este jogo ainda está em construção</h2>
        </div>
      </div>

      <div v-else class="standby">
        <v-icon size="96" color="surface-variant" class="mb-4">mdi-television-off</v-icon>
        <h2 class="text-h3 font-weight-bold mb-2">À espera da próxima partida…</h2>
        <p class="text-h6 text-medium-emphasis">O apresentador vai escolher o próximo confronto.</p>
      </div>
    </template>

  </div>
</template>

<style scoped>
.champion-glow {
  box-shadow: 0 0 80px rgba(255, 214, 0, 0.7);
  outline: 4px solid rgb(var(--v-theme-accent));
  outline-offset: 4px;
}
.player-avatar { outline: 3px solid rgba(255,255,255,0.15); outline-offset: 3px; transition: outline-color 0.3s, box-shadow 0.3s; }
.player-avatar--jogar   { outline-color: rgb(var(--v-theme-success)); box-shadow: 0 0 20px rgba(0,230,118,0.4); }
.player-avatar--plateia { outline-color: rgb(var(--v-theme-primary)); box-shadow: 0 0 20px rgba(0,229,255,0.4); }
.player-avatar--pending { outline-color: rgba(255,255,255,0.2); }

.jogador-lobby { width: 110px; }

.lobby-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 64px;
  align-items: center;
  padding: 2vh 2vw;
}
@media (max-width: 960px) {
  .lobby-grid { grid-template-columns: 1fr; gap: 40px; }
}

.qr-painel { display: flex; flex-direction: column; align-items: center; }
.jogadores-painel { display: flex; flex-direction: column; align-items: center; }
.jogadores-lobby {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 32px 28px; max-width: 900px; margin: 0 auto;
}

.standby {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  /* Altura útil = viewport - cabeçalho (≈ pa-8 + logo/título + mb-6) */
  min-height: calc(100vh - 220px);
}

.confronto {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
}
.jogador-mini { flex: 1; min-width: 0; }
.vs-grande { font-size: 1.4rem; font-weight: 900; color: rgba(255,255,255,0.5); flex-shrink: 0; }

.ring-blue { outline: 4px solid #00B0FF; outline-offset: 4px; background: rgba(0,176,255,0.15); box-shadow: 0 0 40px rgba(0,176,255,0.5); }
.ring-red  { outline: 4px solid #FF1744; outline-offset: 4px; background: rgba(255,23,68,0.15); box-shadow: 0 0 40px rgba(255,23,68,0.5); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
</style>
