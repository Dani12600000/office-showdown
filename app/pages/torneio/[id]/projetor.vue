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
  confirmados, partidasRonda, perfilDe, partidaDestaque,
  faseAtual, jogoAtual,
  carregarLobby,
} = useLobby(torneioId)

await carregarLobby()

const emLobby   = computed(() => torneio.value?.status === 'LOBBY')
const naArvore  = computed(() => torneio.value?.status === 'ARVORE')
const emJogo    = computed(() => torneio.value?.status === 'JOGO')
const terminado = computed(() => torneio.value?.status === 'FINAL')
const campeao   = computed(() => perfilDe(torneio.value?.vencedor_id ?? null))

// ---- Partida em destaque ----
const dest    = computed(() => partidaDestaque.value)
const estadoD = computed<any>(() => dest.value?.estado ?? {})
const j1      = computed(() => perfilDe(dest.value?.jogador1_id ?? null))
const j2      = computed(() => perfilDe(dest.value?.jogador2_id ?? null))
const pontos1 = computed(() => estadoD.value.pontos_j1 ?? 0)
const pontos2 = computed(() => estadoD.value.pontos_j2 ?? 0)
const subRonda = computed(() => estadoD.value.sub_ronda ?? 1)
const j1Jogou = computed(() => !!estadoD.value.escolha_j1)
const j2Jogou = computed(() => !!estadoD.value.escolha_j2)
const destTerminada = computed(() => dest.value?.status === 'TERMINADO')
const destVencedor  = computed(() =>
  dest.value?.vencedor_id === j1.value?.id ? j1.value : j2.value
)

// Fase de revelação (5s do servidor)
const agora = useAgora()
const revelando = computed(() => {
  const r = dest.value?.revelar_ate
  return r ? new Date(r).getTime() > agora.value : false
})
// Vencedor só aparece depois da revelação
const vitoriaVisivel = computed(() => destTerminada.value && !revelando.value)

const escolhasMap: Record<string, string> = { pedra: '✊', papel: '✋', tesoura: '✌️' }
const emoji = (v: string | null | undefined) => (v ? escolhasMap[v] : '❔')

const ultima = computed(() => {
  const h = estadoD.value.historico ?? []
  return h.length ? h[h.length - 1] : null
})
const resultadoUltima = computed(() => {
  const u = ultima.value
  if (!u) return null
  if (!u.vencedor) return { texto: 'Empate', cor: 'warning' }
  const nome = u.vencedor === j1.value?.id ? j1.value?.name : j2.value?.name
  return { texto: `${nome} ganha a ronda`, cor: 'success' }
})

const inicial = (id: string | null) => perfilDe(id)?.name?.charAt(0).toUpperCase() ?? '?'

// ---- Confetti ----
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

// Burst quando o vencedor da partida em destaque é revelado (após os 5s)
watch(vitoriaVisivel, (vis, antes) => {
  if (vis && !antes) confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } })
})

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

    <!-- ===== CAMPEÃO DO TORNEIO ===== -->
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

      <!-- Painel do QR (entrar) -->
      <div class="qr-painel text-center">
        <p class="text-overline text-medium-emphasis mb-2" style="font-size:1rem !important">Entra no jogo</p>
        <QrCode :value="urlEntrada" :size="300" class="mx-auto" />
        <p class="text-h5 font-weight-bold mt-5">
          <v-icon color="primary" class="mr-1">mdi-cellphone</v-icon>
          Aponta a câmara do telemóvel
        </p>
        <p class="text-body-1 text-medium-emphasis mt-1">Regista-te e escolhe se queres jogar ou ficar na plateia.</p>
      </div>

      <!-- Jogadores já dentro -->
      <div class="jogadores-painel">
        <v-chip size="large" color="success" class="mb-6">
          <v-icon start>mdi-door-open</v-icon>Inscrições abertas
        </v-chip>
        <div class="jogadores-lobby">
          <div v-for="c in confirmados" :key="c.id" class="text-center">
            <v-avatar size="84" color="primary" class="player-avatar mb-2">
              <v-img v-if="c.utilizador?.avatar_url" :src="c.utilizador.avatar_url" cover />
              <span v-else class="text-h5 font-weight-black text-surface">{{ c.utilizador?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold">{{ c.utilizador?.name }}</div>
          </div>
          <div v-if="!confirmados.length" class="text-h6 text-medium-emphasis py-8">À espera dos primeiros jogadores…</div>
        </div>
      </div>

    </div>

    <!-- ===== ARVORE: REVELAÇÃO DOS CONFRONTOS ===== -->
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
      <!-- Há partida em destaque → palco ao vivo -->
      <div v-if="dest" class="palco">
        <div class="arena mb-8">
          <!-- Jogador 1 -->
          <div class="text-center jogador" :class="{ 'jogador--lose': vitoriaVisivel && dest.vencedor_id !== j1?.id }">
            <v-avatar size="180" class="ring-blue mb-3">
              <v-img v-if="j1?.avatar_url" :src="j1.avatar_url" cover />
              <span v-else class="text-blue font-weight-black" style="font-size:4rem">{{ inicial(dest.jogador1_id) }}</span>
            </v-avatar>
            <h2 class="text-h4 font-weight-black">{{ j1?.name }}</h2>
            <div class="mt-2">
              <v-chip v-if="!vitoriaVisivel && !revelando && j1Jogou" color="success" size="small"><v-icon start size="14">mdi-check</v-icon>Já jogou</v-chip>
              <v-chip v-else-if="!vitoriaVisivel && !revelando" color="surface-variant" size="small">A pensar…</v-chip>
            </div>
          </div>

          <!-- Placar -->
          <div class="text-center">
            <div class="placar">
              <span class="text-blue">{{ pontos1 }}</span>
              <span class="text-medium-emphasis mx-3">:</span>
              <span class="text-red">{{ pontos2 }}</span>
            </div>
            <v-chip v-if="!vitoriaVisivel" size="small" variant="tonal">Ronda {{ subRonda }} · à melhor de 3</v-chip>
            <v-chip v-else color="accent" size="large" class="font-weight-bold"><v-icon start>mdi-trophy</v-icon>{{ destVencedor?.name }} vence!</v-chip>
          </div>

          <!-- Jogador 2 -->
          <div class="text-center jogador" :class="{ 'jogador--lose': vitoriaVisivel && dest.vencedor_id !== j2?.id }">
            <v-avatar size="180" class="ring-red mb-3">
              <v-img v-if="j2?.avatar_url" :src="j2.avatar_url" cover />
              <span v-else class="text-red font-weight-black" style="font-size:4rem">{{ inicial(dest.jogador2_id) }}</span>
            </v-avatar>
            <h2 class="text-h4 font-weight-black">{{ j2?.name }}</h2>
            <div class="mt-2">
              <v-chip v-if="!vitoriaVisivel && !revelando && j2Jogou" color="success" size="small"><v-icon start size="14">mdi-check</v-icon>Já jogou</v-chip>
              <v-chip v-else-if="!vitoriaVisivel && !revelando" color="surface-variant" size="small">A pensar…</v-chip>
            </div>
          </div>
        </div>

        <!-- Revelação da última ronda — só durante os 5s; depois some e volta a "A pensar" -->
        <v-expand-transition>
          <div v-if="resultadoUltima && revelando" class="text-center reveal">
            <div class="d-flex align-center justify-center gap-10">
              <div class="emoji text-blue">{{ emoji(ultima.e1) }}</div>
              <span class="text-h5 text-medium-emphasis">vs</span>
              <div class="emoji text-red">{{ emoji(ultima.e2) }}</div>
            </div>
            <v-chip :color="resultadoUltima.cor" size="large" class="mt-4 font-weight-bold">{{ resultadoUltima.texto }}</v-chip>
          </div>
        </v-expand-transition>
      </div>

      <!-- Sem destaque → standby -->
      <div v-else class="text-center py-12">
        <v-icon size="80" color="surface-variant" class="mb-4">mdi-television-off</v-icon>
        <h2 class="text-h4 font-weight-bold mb-2">À espera da próxima partida…</h2>
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
.player-avatar { outline: 3px solid rgba(0,229,255,0.5); outline-offset: 3px; }

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

.qr-painel {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.jogadores-painel {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.jogadores-lobby {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 32px 28px;
  max-width: 900px;
  margin: 0 auto;
}

.palco { padding-top: 2vh; }

.confronto {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
}
.jogador-mini { flex: 1; min-width: 0; }
.vs-grande {
  font-size: 1.4rem;
  font-weight: 900;
  color: rgba(255,255,255,0.5);
  flex-shrink: 0;
}

.arena {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(48px, 9vw, 140px);
}

.jogador {
  width: clamp(180px, 18vw, 260px);
  transition: opacity 0.4s;
}
.jogador--lose { opacity: 0.35; }

.placar {
  font-size: clamp(4rem, 7vw, 7rem);
  font-weight: 900;
  line-height: 1;
  padding: 0 12px;
  white-space: nowrap;
}

.reveal { margin-top: 2vh; }
.emoji { font-size: 7rem; line-height: 1; }

.ring-blue { outline: 4px solid #00B0FF; outline-offset: 4px; background: rgba(0,176,255,0.15); box-shadow: 0 0 40px rgba(0,176,255,0.5); }
.ring-red  { outline: 4px solid #FF1744; outline-offset: 4px; background: rgba(255,23,68,0.15); box-shadow: 0 0 40px rgba(255,23,68,0.5); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
</style>
