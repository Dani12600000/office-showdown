<script setup lang="ts">
import confetti from 'canvas-confetti'
import type { EscolhaPPT } from '~/composables/usePartida'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const torneioId = route.params.id as string
const partidaId = route.params.partidaId as string

const {
  jogador1, jogador2, loading,
  souJogador, souJogador1,
  pontos1, pontos2, subRonda,
  jaEscolhi, adversarioEscolheu, minhaEscolha,
  ultimaJogada, terminada, vencedor, venci,
  carregar, jogar,
} = usePartida(partidaId)

await carregar()

// ---- Escolhas (emojis) ----
const escolhas: { valor: EscolhaPPT; emoji: string; label: string }[] = [
  { valor: 'pedra',   emoji: '✊', label: 'Pedra' },
  { valor: 'papel',   emoji: '✋', label: 'Papel' },
  { valor: 'tesoura', emoji: '✌️', label: 'Tesoura' },
]
const emojiDe = (v: string | null) => escolhas.find(e => e.valor === v)?.emoji ?? '❔'

const aJogar = ref(false)
const erro = ref('')

async function escolher(valor: EscolhaPPT) {
  if (jaEscolhi.value || terminada.value) return
  aJogar.value = true
  erro.value = ''
  try {
    await jogar(valor)
  } catch (e: any) {
    erro.value = e.message
  } finally {
    aJogar.value = false
  }
}

// ---- Confetti ao vencer ----
watch(terminada, (fim) => {
  if (fim && venci.value) {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } })
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 400)
  }
})

// Texto do resultado da última ronda
const resultadoUltima = computed(() => {
  const u = ultimaJogada.value
  if (!u) return null
  if (!u.vencedor) return { texto: 'Empate!', cor: 'warning' }
  const nome = u.vencedor === jogador1.value?.id ? jogador1.value?.name : jogador2.value?.name
  return { texto: `${nome} ganhou a ronda`, cor: 'success' }
})
</script>

<template>
  <div v-if="loading" class="d-flex justify-center align-center" style="min-height:60vh">
    <v-progress-circular indeterminate color="primary" size="56" />
  </div>

  <v-container v-else max-width="760" class="py-6">

    <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" :to="`/torneio/${torneioId}`" class="mb-4 text-medium-emphasis px-1">
      Voltar ao torneio
    </v-btn>

    <div class="text-center mb-2">
      <v-chip size="small" variant="tonal" color="primary">
        <v-icon start size="14">mdi-trophy-variant</v-icon>Pedra · Papel · Tesoura — à melhor de 3
      </v-chip>
    </div>

    <!-- ===== PLACAR ===== -->
    <v-card rounded="xl" elevation="0" class="placar mb-6">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between">

          <!-- Jogador 1 (azul) -->
          <div class="text-center" style="flex:1">
            <v-avatar size="72" class="ring-blue mb-2">
              <v-img v-if="jogador1?.avatar_url" :src="jogador1.avatar_url" cover />
              <span v-else class="text-h5 font-weight-black text-blue">{{ jogador1?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">{{ jogador1?.name }}</div>
          </div>

          <!-- Placar -->
          <div class="text-center px-4">
            <div class="text-h3 font-weight-black">
              <span class="text-blue">{{ pontos1 }}</span>
              <span class="text-medium-emphasis mx-2">:</span>
              <span class="text-red">{{ pontos2 }}</span>
            </div>
            <div class="text-caption text-medium-emphasis">Ronda {{ subRonda }}</div>
          </div>

          <!-- Jogador 2 (vermelho) -->
          <div class="text-center" style="flex:1">
            <v-avatar size="72" class="ring-red mb-2">
              <v-img v-if="jogador2?.avatar_url" :src="jogador2.avatar_url" cover />
              <span v-else class="text-h5 font-weight-black text-red">{{ jogador2?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">{{ jogador2?.name }}</div>
          </div>

        </div>
      </v-card-text>
    </v-card>

    <!-- ===== TERMINADA: VENCEDOR ===== -->
    <div v-if="terminada" class="text-center py-6">
      <v-icon size="64" color="accent" class="mb-2">mdi-trophy</v-icon>
      <h2 class="text-h4 font-weight-black mb-1">
        {{ venci ? 'Ganhaste! 🎉' : `${vencedor?.name} venceu` }}
      </h2>
      <p class="text-body-2 text-medium-emphasis mb-4">Resultado final {{ pontos1 }} – {{ pontos2 }}</p>
      <v-btn color="primary" rounded="lg" prepend-icon="mdi-arrow-left" :to="`/torneio/${torneioId}`">
        Voltar ao torneio
      </v-btn>
    </div>

    <template v-else>
      <!-- ===== RESULTADO DA ÚLTIMA RONDA ===== -->
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

      <!-- ===== ZONA DE JOGO ===== -->
      <!-- Jogador: escolher -->
      <div v-if="souJogador">
        <div v-if="jaEscolhi" class="text-center py-6">
          <div class="emoji-reveal mb-3">{{ emojiDe(minhaEscolha) }}</div>
          <v-progress-circular indeterminate color="primary" size="28" class="mb-2" />
          <p class="text-body-1 font-weight-medium">À espera do adversário…</p>
        </div>

        <div v-else>
          <p class="text-center text-body-1 text-medium-emphasis mb-4">A tua vez — escolhe:</p>
          <div class="d-flex justify-center gap-4 flex-wrap">
            <v-card
              v-for="e in escolhas" :key="e.valor"
              rounded="xl" elevation="0"
              class="escolha-card"
              :class="{ 'escolha-card--disabled': aJogar }"
              @click="escolher(e.valor)"
            >
              <v-card-text class="text-center pa-6">
                <div class="escolha-emoji">{{ e.emoji }}</div>
                <div class="text-body-2 font-weight-bold mt-2">{{ e.label }}</div>
              </v-card-text>
            </v-card>
          </div>
        </div>
      </div>

      <!-- Espectador -->
      <div v-else class="text-center py-6">
        <v-icon size="40" color="surface-variant" class="mb-2">mdi-eye-outline</v-icon>
        <p class="text-body-1 text-medium-emphasis">
          {{ adversarioEscolheu ? 'Jogadas em curso…' : 'A aguardar as jogadas…' }}
        </p>
      </div>
    </template>

    <v-snackbar :model-value="!!erro" color="error" timeout="4000" @update:model-value="erro = ''">
      {{ erro }}
    </v-snackbar>

  </v-container>
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

.escolha-card {
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
  width: 120px;
}
.escolha-card:hover {
  transform: translateY(-6px) scale(1.04);
  border-color: rgb(var(--v-theme-primary));
  background: rgba(0,229,255,0.08);
}
.escolha-card--disabled { opacity: 0.5; pointer-events: none; }

.escolha-emoji { font-size: 56px; line-height: 1; }
.emoji-reveal { font-size: 64px; line-height: 1; }
</style>
