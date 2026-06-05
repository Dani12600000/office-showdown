<script setup lang="ts">
import confetti from 'canvas-confetti'

const props = defineProps<{ partidaId: string; comoId: string | null }>()
// Vue desempacota refs em props → reembrulho num computed para o composable.
const comoRef = computed(() => props.comoId)

const {
  jogador1, jogador2, loading,
  controlo1, controlo2, souEspectador,
  tabuleiro, vez, linhaVencedora, empates,
  minhaVez, jogadorDaVez, idDaJogada, colunaCheia,
  terminada, vencedor, venci, perdi,
  emDestaque, apostasAbertas, podeJogar, revelando, vitoriaVisivel,
  carregar, jogar,
} = usePartidaQuatro(props.partidaId, comoRef)

const mostrarControlos = computed(() => podeJogar.value)

await carregar()

const aJogar = ref(false)
const erro = ref('')

const idx = (row: number, col: number) => row * 7 + col
const peca = (row: number, col: number) => tabuleiro.value[idx(row, col)]
const corDe = (n: 1 | 2 | null) => n === 1 ? 'blue' : n === 2 ? 'red' : null
const jogadorDe = (n: 1 | 2 | null) => n === 1 ? jogador1.value : n === 2 ? jogador2.value : null
const ehVencedora = (row: number, col: number) => !!linhaVencedora.value?.includes(idx(row, col))

const podeJogarColuna = (col: number) =>
  mostrarControlos.value && minhaVez.value && !revelando.value &&
  !terminada.value && !souEspectador.value && !colunaCheia(col) && !aJogar.value

async function clicar(col: number) {
  if (!podeJogarColuna(col)) return
  aJogar.value = true
  erro.value = ''
  try { await jogar(col, idDaJogada.value ?? undefined) }
  catch (e: any) { erro.value = e.message }
  finally { aJogar.value = false }
}

watch(terminada, (fim) => {
  if (fim && venci.value) {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } })
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 400)
  }
})

const meuLado = computed<'blue' | 'red' | null>(() => {
  if (controlo1.value) return 'blue'
  if (controlo2.value) return 'red'
  return null
})

const torneioId = useRoute().params.id as string
</script>

<template>
  <div v-if="loading" class="d-flex justify-center align-center" style="min-height:60vh">
    <v-progress-circular indeterminate color="primary" size="56" />
  </div>

  <template v-else>
    <!-- CABEÇALHO COM JOGADORES -->
    <v-card rounded="xl" elevation="0" class="placar mb-5">
      <v-card-text class="pa-5">
        <div class="d-flex align-center justify-space-between">
          <div class="text-center" style="flex:1">
            <v-avatar size="60" class="ring-blue mb-2" :class="{ 'glow-on': vez === 1 && !terminada }">
              <v-img v-if="jogador1?.avatar_url" :src="jogador1.avatar_url" cover />
              <span v-else class="text-h6 font-weight-black text-blue">{{ jogador1?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">{{ jogador1?.name }}</div>
          </div>
          <div class="text-center px-3">
            <v-chip v-if="!terminada" size="small" variant="tonal" color="primary">
              <v-icon start size="14">mdi-arrow-right-bold</v-icon>
              Vez de {{ jogadorDaVez?.name }}
            </v-chip>
            <v-chip v-else color="accent" size="small" class="font-weight-bold">
              <v-icon start size="14">mdi-trophy</v-icon>{{ vencedor?.name }}
            </v-chip>
            <div v-if="empates > 0" class="text-caption text-medium-emphasis mt-1">
              {{ empates }} empate{{ empates > 1 ? 's' : '' }}
            </div>
          </div>
          <div class="text-center" style="flex:1">
            <v-avatar size="60" class="ring-red mb-2" :class="{ 'glow-on': vez === 2 && !terminada }">
              <v-img v-if="jogador2?.avatar_url" :src="jogador2.avatar_url" cover />
              <span v-else class="text-h6 font-weight-black text-red">{{ jogador2?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">{{ jogador2?.name }}</div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- TERMINADA (após revelação) -->
    <div v-if="vitoriaVisivel" class="text-center py-4">
      <template v-if="venci">
        <v-icon size="72" color="accent" class="mb-2">mdi-trophy</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">Ganhaste! 🎉</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">Segues para a próxima ronda.</p>
      </template>
      <template v-else-if="perdi">
        <v-icon size="72" color="error" class="mb-2">mdi-emoticon-sad-outline</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">Perdeste</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ vencedor?.name }} venceu desta vez. Obrigado por jogares!</p>
      </template>
      <template v-else>
        <v-icon size="72" color="accent" class="mb-2">mdi-trophy</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">{{ vencedor?.name }} venceu</h2>
      </template>
      <v-btn color="primary" rounded="lg" prepend-icon="mdi-arrow-left" :to="`/torneio/${torneioId}`" class="mt-3">
        Voltar ao torneio
      </v-btn>
    </div>

    <template v-else>
      <!-- À espera de estar em destaque -->
      <div v-if="!mostrarControlos && !souEspectador" class="text-center py-6 mb-2">
        <v-icon size="48" color="surface-variant" class="mb-3">{{ apostasAbertas ? 'mdi-cash-multiple' : 'mdi-television-off' }}</v-icon>
        <h3 class="text-h6 font-weight-bold mb-1">{{ apostasAbertas ? 'Apostas a decorrer…' : 'Aguarda a tua vez no palco' }}</h3>
        <p class="text-body-2 text-medium-emphasis">
          {{ apostasAbertas
            ? 'A plateia está a apostar. O jogo começa quando o apresentador fechar as apostas.'
            : 'Vais poder jogar quando a partida estiver em destaque no projetor.' }}
        </p>
      </div>

      <!-- TABULEIRO 7×6 -->
      <div class="tabuleiro-wrap">
        <div class="tabuleiro">
          <button
            v-for="c in 7" :key="c - 1"
            class="coluna"
            :class="{ 'coluna--ativa': podeJogarColuna(c - 1) }"
            :disabled="!podeJogarColuna(c - 1)"
            @click="clicar(c - 1)"
          >
            <div
              v-for="r in 6" :key="r - 1"
              class="casa"
              :class="[peca(r - 1, c - 1) ? `casa--${corDe(peca(r - 1, c - 1))}` : '', { 'casa--win': ehVencedora(r - 1, c - 1) }]"
            >
              <v-avatar v-if="peca(r - 1, c - 1)" size="38" :class="corDe(peca(r - 1, c - 1)) === 'blue' ? 'ring-blue' : 'ring-red'">
                <v-img v-if="jogadorDe(peca(r - 1, c - 1))?.avatar_url" :src="jogadorDe(peca(r - 1, c - 1))!.avatar_url!" cover />
                <span v-else class="font-weight-black" :class="`text-${corDe(peca(r - 1, c - 1))}`" style="font-size:0.95rem">
                  {{ jogadorDe(peca(r - 1, c - 1))?.name?.charAt(0).toUpperCase() }}
                </span>
              </v-avatar>
            </div>
          </button>
        </div>
      </div>

      <!-- Mensagem por baixo -->
      <div class="text-center mt-5">
        <p v-if="revelando" class="text-body-2 text-medium-emphasis">
          <v-icon size="16">mdi-eye</v-icon> Revelação… o próximo lance começa já.
        </p>
        <p v-else-if="souEspectador" class="text-body-2 text-medium-emphasis">
          <v-icon size="16">mdi-eye-outline</v-icon> Estás a assistir.
        </p>
        <p v-else-if="!mostrarControlos" class="text-body-2 text-medium-emphasis">
          O tabuleiro só fica jogável quando o admin apresentar esta partida.
        </p>
        <p v-else-if="minhaVez" class="text-body-1 font-weight-bold" :class="meuLado === 'blue' ? 'text-blue' : 'text-red'">
          A tua vez — escolhe uma coluna.
        </p>
        <p v-else class="text-body-2 text-medium-emphasis">
          A pensar… ({{ jogadorDaVez?.name }})
        </p>
      </div>
    </template>

    <v-snackbar :model-value="!!erro" color="error" timeout="4000" @update:model-value="erro = ''">
      {{ erro }}
    </v-snackbar>
  </template>
</template>

<style scoped>
.placar { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }

.ring-blue { outline: 3px solid #00B0FF; outline-offset: 2px; background: rgba(0,176,255,0.15);
  box-shadow: 0 0 14px rgba(0,176,255,0.4); }
.ring-red  { outline: 3px solid #FF1744; outline-offset: 2px; background: rgba(255,23,68,0.15);
  box-shadow: 0 0 14px rgba(255,23,68,0.4); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }

.glow-on { animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse {
  0%,100% { box-shadow: 0 0 16px rgba(255,255,255,0.2); }
  50%     { box-shadow: 0 0 32px rgba(0,229,255,0.7); }
}

.tabuleiro-wrap { display: flex; justify-content: center; }
.tabuleiro {
  display: flex;
  gap: 6px;
  padding: 12px;
  border-radius: 18px;
  /* Tabuleiro azul clássico do Quatro em Linha, em tom néon escuro */
  background: linear-gradient(180deg, rgba(0,80,140,0.25), rgba(0,40,90,0.35));
  border: 1px solid rgba(0,176,255,0.25);
}
.coluna {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;
}
.coluna:disabled { cursor: default; }
.coluna--ativa:hover { background: rgba(0,229,255,0.12); }

.casa {
  width: 46px; height: 46px;
  border-radius: 50%;
  background: rgba(13,13,26,0.6);
  border: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
}
.casa--win { box-shadow: 0 0 18px rgba(255, 214, 0, 0.8); border-color: rgb(var(--v-theme-accent)); }

@media (max-width: 420px) {
  .casa { width: 40px; height: 40px; }
}
</style>
