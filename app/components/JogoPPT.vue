<script setup lang="ts">
import confetti from 'canvas-confetti'
import type { EscolhaPPT } from '~/composables/usePartida'

const props = defineProps<{ partidaId: string; comoId: string | null }>()
// Vue desempacota refs em props → reembrulho num computed para o composable.
const comoRef = computed(() => props.comoId)

const {
  jogador1, jogador2, loading,
  controlo1, controlo2, souEspectador,
  escolha1, escolha2,
  pontos1, pontos2, subRonda,
  ultimaJogada, terminada, vencedor, venci, perdi,
  emDestaque, apostasAbertas, podeJogar, revelando, vitoriaVisivel,
  carregar, jogar,
} = usePartida(props.partidaId, comoRef)

const mostrarControlos = computed(() => podeJogar.value)

await carregar()

const escolhas: { valor: EscolhaPPT; emoji: string; label: string }[] = [
  { valor: 'pedra',   emoji: '✊', label: 'Pedra' },
  { valor: 'papel',   emoji: '✋', label: 'Papel' },
  { valor: 'tesoura', emoji: '✌️', label: 'Tesoura' },
]
const emojiDe = (v: string | null) => escolhas.find(e => e.valor === v)?.emoji ?? '❔'

const slots = computed(() => [
  { jogador: jogador1.value, escolha: escolha1.value, controlo: controlo1.value, cor: 'blue' as const },
  { jogador: jogador2.value, escolha: escolha2.value, controlo: controlo2.value, cor: 'red' as const },
])
const slotsAdversario = computed(() => slots.value.filter(s => !s.controlo))
const slotsControlo   = computed(() => slots.value.filter(s => s.controlo))

const aJogar = ref<string | null>(null)
const erro = ref('')

async function escolher(valor: EscolhaPPT, jogadorId: string) {
  if (terminada.value) return
  aJogar.value = jogadorId
  erro.value = ''
  try { await jogar(valor, jogadorId) }
  catch (e: any) { erro.value = e.message }
  finally { aJogar.value = null }
}

watch(terminada, (fim) => {
  if (fim && venci.value) {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } })
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 400)
  }
})

const resultadoUltima = computed(() => {
  const u = ultimaJogada.value
  if (!u) return null
  if (!u.vencedor) return { texto: 'Empate!', cor: 'warning' }
  const nome = u.vencedor === jogador1.value?.id ? jogador1.value?.name : jogador2.value?.name
  return { texto: `${nome} ganhou a ronda`, cor: 'success' }
})

const torneioId = useRoute().params.id as string
</script>

<template>
  <div v-if="loading" class="d-flex justify-center align-center" style="min-height:60vh">
    <v-progress-circular indeterminate color="primary" size="56" />
  </div>

  <template v-else>
    <!-- PLACAR -->
    <v-card rounded="xl" elevation="0" class="placar mb-6">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between">
          <div class="text-center" style="flex:1">
            <v-avatar size="72" class="ring-blue mb-2">
              <v-img v-if="jogador1?.avatar_url" :src="jogador1.avatar_url" cover />
              <span v-else class="text-h5 font-weight-black text-blue">{{ jogador1?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">
              {{ jogador1?.name }}
              <v-icon v-if="jogador1?.is_bot" size="13" class="text-medium-emphasis">mdi-robot</v-icon>
            </div>
          </div>

          <div class="text-center px-4">
            <div class="text-h3 font-weight-black">
              <span class="text-blue">{{ pontos1 }}</span>
              <span class="text-medium-emphasis mx-2">:</span>
              <span class="text-red">{{ pontos2 }}</span>
            </div>
            <div class="text-caption text-medium-emphasis">Ronda {{ subRonda }}</div>
          </div>

          <div class="text-center" style="flex:1">
            <v-avatar size="72" class="ring-red mb-2">
              <v-img v-if="jogador2?.avatar_url" :src="jogador2.avatar_url" cover />
              <span v-else class="text-h5 font-weight-black text-red">{{ jogador2?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">
              {{ jogador2?.name }}
              <v-icon v-if="jogador2?.is_bot" size="13" class="text-medium-emphasis">mdi-robot</v-icon>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- TERMINADA -->
    <div v-if="vitoriaVisivel" class="text-center py-6">
      <template v-if="venci">
        <v-icon size="72" color="accent" class="mb-2">mdi-trophy</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">Ganhaste! 🎉</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Segues para a próxima ronda. Resultado final {{ pontos1 }} – {{ pontos2 }}
        </p>
      </template>
      <template v-else-if="perdi">
        <v-icon size="72" color="error" class="mb-2">mdi-emoticon-sad-outline</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">Perdeste</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ vencedor?.name }} venceu {{ pontos1 }} – {{ pontos2 }}. Obrigado por jogares!
        </p>
      </template>
      <template v-else>
        <v-icon size="72" color="accent" class="mb-2">mdi-trophy</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">{{ vencedor?.name }} venceu</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">Resultado final {{ pontos1 }} – {{ pontos2 }}</p>
      </template>
      <v-btn color="primary" rounded="lg" prepend-icon="mdi-arrow-left" :to="`/torneio/${torneioId}`">
        Voltar ao torneio
      </v-btn>
    </div>

    <template v-else>
      <!-- Resultado da última ronda -->
      <v-expand-transition>
        <div v-if="resultadoUltima" class="text-center mb-6">
          <div class="d-flex align-center justify-center gap-6 mb-2">
            <div class="emoji-reveal text-blue">{{ emojiDe(ultimaJogada.e1) }}</div>
            <span class="text-medium-emphasis">vs</span>
            <div class="emoji-reveal text-red">{{ emojiDe(ultimaJogada.e2) }}</div>
          </div>
          <v-chip :color="resultadoUltima.cor" size="small" variant="tonal">{{ resultadoUltima.texto }}</v-chip>
        </div>
      </v-expand-transition>

      <div v-if="!mostrarControlos" class="text-center py-10">
        <v-icon size="48" color="surface-variant" class="mb-3">{{ apostasAbertas ? 'mdi-cash-multiple' : 'mdi-television-off' }}</v-icon>
        <h3 class="text-h6 font-weight-bold mb-1">{{ apostasAbertas ? 'Apostas a decorrer…' : 'Aguarda a tua vez no palco' }}</h3>
        <p class="text-body-2 text-medium-emphasis">
          {{ apostasAbertas
            ? 'A plateia está a apostar. O jogo começa quando o apresentador fechar as apostas.'
            : 'Os controlos só ficam disponíveis quando esta partida estiver a ser apresentada no projetor.' }}
        </p>
      </div>

      <div v-else-if="revelando" class="text-center py-8">
        <v-icon size="40" color="primary" class="mb-2">mdi-eye</v-icon>
        <p class="text-body-1 font-weight-medium">Revelação da jogada…</p>
        <p class="text-caption text-medium-emphasis">A próxima ronda começa já de seguida.</p>
      </div>

      <div v-else>
        <div
          v-for="s in slotsAdversario" :key="'adv-' + s.cor"
          class="text-center py-2 mb-3"
        >
          <span class="text-body-2 text-medium-emphasis">
            <v-icon size="16" class="mr-1" :color="s.escolha ? 'success' : undefined">
              {{ s.escolha ? 'mdi-check-circle' : 'mdi-clock-outline' }}
            </v-icon>
            {{ s.jogador?.name }} {{ s.escolha ? 'já jogou' : 'a pensar…' }}
          </span>
        </div>

        <div class="d-flex flex-column gap-5">
          <v-card
            v-for="s in slotsControlo" :key="'ctl-' + s.cor"
            rounded="xl" elevation="0" class="slot-card" :class="`slot-card--${s.cor}`"
          >
            <v-card-text class="pa-4">
              <div class="d-flex align-center gap-2 mb-3">
                <v-avatar size="28" :class="s.cor === 'blue' ? 'ring-blue' : 'ring-red'">
                  <v-img v-if="s.jogador?.avatar_url" :src="s.jogador.avatar_url" cover />
                  <span v-else class="text-caption font-weight-black" :class="`text-${s.cor}`">{{ s.jogador?.name?.charAt(0).toUpperCase() }}</span>
                </v-avatar>
                <span class="text-body-2 font-weight-bold">{{ s.jogador?.name }}</span>
                <v-chip v-if="s.jogador?.is_bot" size="x-small" variant="tonal">
                  <v-icon start size="11">mdi-robot</v-icon>controlado por ti
                </v-chip>
              </div>

              <div v-if="s.escolha" class="text-center py-2">
                <div class="emoji-reveal">{{ emojiDe(s.escolha) }}</div>
                <p class="text-caption text-medium-emphasis mt-1">Escolha feita — à espera da outra jogada…</p>
              </div>

              <div v-else class="d-flex justify-center gap-3 flex-wrap">
                <v-card
                  v-for="e in escolhas" :key="e.valor"
                  rounded="lg" elevation="0"
                  class="escolha-card"
                  :class="{ 'escolha-card--disabled': aJogar === s.jogador?.id }"
                  @click="s.jogador && escolher(e.valor, s.jogador.id)"
                >
                  <v-card-text class="text-center pa-4">
                    <div class="escolha-emoji">{{ e.emoji }}</div>
                    <div class="text-caption font-weight-bold mt-1">{{ e.label }}</div>
                  </v-card-text>
                </v-card>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </div>

      <div v-if="souEspectador && emDestaque && !revelando" class="text-center py-4 mt-2">
        <v-icon size="36" color="surface-variant" class="mb-1">mdi-eye-outline</v-icon>
        <p class="text-body-2 text-medium-emphasis">Estás a assistir a esta partida.</p>
      </div>
    </template>

    <v-snackbar :model-value="!!erro" color="error" timeout="4000" @update:model-value="erro = ''">
      {{ erro }}
    </v-snackbar>
  </template>
</template>

<style scoped>
.placar {
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
}
.ring-blue { outline: 3px solid #00B0FF; outline-offset: 3px; background: rgba(0,176,255,0.15);
  box-shadow: 0 0 20px rgba(0,176,255,0.4); }
.ring-red  { outline: 3px solid #FF1744; outline-offset: 3px; background: rgba(255,23,68,0.15);
  box-shadow: 0 0 20px rgba(255,23,68,0.4); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }

.slot-card { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
.slot-card--blue { border-color: rgba(0,176,255,0.3); }
.slot-card--red  { border-color: rgba(255,23,68,0.3); }

.escolha-card {
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
  width: 96px;
}
.escolha-card:hover {
  transform: translateY(-5px) scale(1.04);
  border-color: rgb(var(--v-theme-primary));
  background: rgba(0,229,255,0.08);
}
.escolha-card--disabled { opacity: 0.5; pointer-events: none; }
.escolha-emoji { font-size: 44px; line-height: 1; }
.emoji-reveal { font-size: 60px; line-height: 1; }
</style>
