<script setup lang="ts">
import type { Partida } from '~/composables/useLobby'
import type { Utilizador, Aposta } from '~/types/torneio'

const props = defineProps<{
  partida: Partida | null
  jogador1: Utilizador | null
  jogador2: Utilizador | null
  apostasAbertas: boolean
  minhaAposta: Aposta | null
  saldo: number
  pote1: number
  pote2: number
  n1: number
  n2: number
}>()
const emit = defineEmits<{ apostar: [alvoId: string, montante: number] }>()

const terminada = computed(() => props.partida?.status === 'TERMINADO')
const poteTotal = computed(() => props.pote1 + props.pote2)
const pct1 = computed(() => poteTotal.value ? Math.round((props.pote1 / poteTotal.value) * 100) : 50)
const pct2 = computed(() => 100 - pct1.value)

// Quota (multiplicador parimutuel atual) por lado
const quota = (poteLado: number) => (poteLado > 0 ? (poteTotal.value / poteLado) : 0)

// Lado já escolhido (se já apostei, fica fixo)
const alvoFixo = computed(() => props.minhaAposta?.alvo_id ?? null)
const alvo = ref<string | null>(null)
watch(() => props.minhaAposta?.alvo_id, (a) => { if (a) alvo.value = a }, { immediate: true })

// O alvo só é válido se corresponder a um dos dois jogadores em palco.
// (Ao trocar de partida, um alvo "fantasma" da anterior deixa de bater.)
const alvoValido = computed(() =>
  alvo.value === props.jogador1?.id || alvo.value === props.jogador2?.id
)

// Limpa a seleção quando muda de confronto e o alvo já não pertence à partida.
watch(() => props.partida?.id, () => {
  if (!alvoValido.value) alvo.value = alvoFixo.value
})

const montante = ref(10)
watch(() => props.saldo, (s) => { if (montante.value > s) montante.value = Math.max(1, s) })

const aApostar = ref(false)
const erro = ref('')

function escolherAlvo(id: string | undefined | null) {
  if (!id) return
  if (alvoFixo.value && alvoFixo.value !== id) return // não troca de lado
  alvo.value = id
}
function setMontante(v: number) { montante.value = Math.max(1, Math.min(v, props.saldo)) }

const nomeAlvo = computed(() =>
  alvo.value === props.jogador1?.id ? props.jogador1?.name
  : alvo.value === props.jogador2?.id ? props.jogador2?.name : null
)

async function confirmar() {
  if (!alvoValido.value || montante.value < 1 || montante.value > props.saldo) return
  aApostar.value = true; erro.value = ''
  try { emit('apostar', alvo.value, montante.value) }
  finally { aApostar.value = false }
}

const resultado = computed(() => {
  const a = props.minhaAposta
  if (!a || !a.liquidada) return null
  return a.ganho >= 0
    ? { texto: `Ganhaste +${a.ganho} 🪙`, cor: 'success' }
    : { texto: `Perdeste ${a.montante} 🪙`, cor: 'error' }
})
</script>

<template>
  <v-card rounded="xl" class="aposta-card">
    <v-card-text class="pa-5">
      <!-- Sem partida no palco -->
      <div v-if="!partida || (!jogador1 && !jogador2)" class="text-center py-6">
        <v-icon size="48" color="surface-variant" class="mb-2">mdi-cash-clock</v-icon>
        <h3 class="text-h6 font-weight-bold">Aguarda o próximo confronto</h3>
        <p class="text-body-2 text-medium-emphasis">As apostas abrem quando o apresentador mostrar uma partida.</p>
      </div>

      <template v-else>
        <div class="d-flex align-center justify-space-between mb-3">
          <span class="text-overline">{{ apostasAbertas ? 'Apostas abertas' : (terminada ? 'Resultado' : 'Apostas fechadas') }}</span>
          <v-chip size="small" variant="tonal" color="accent">
            <v-icon start size="14">mdi-circle-multiple</v-icon>{{ saldo }} moedas
          </v-chip>
        </div>

        <!-- Barra do pote (sentimento da casa) -->
        <div class="pote-bar mb-1">
          <div class="pote-lado pote-blue" :style="{ width: pct1 + '%' }">
            <span v-if="pct1 > 12">{{ pct1 }}%</span>
          </div>
          <div class="pote-lado pote-red" :style="{ width: pct2 + '%' }">
            <span v-if="pct2 > 12">{{ pct2 }}%</span>
          </div>
        </div>
        <div class="d-flex justify-space-between text-caption text-medium-emphasis mb-4">
          <span>{{ pote1 }} 🪙 · {{ n1 }} apostas</span>
          <span>{{ pote2 }} 🪙 · {{ n2 }} apostas</span>
        </div>

        <!-- Resultado final -->
        <div v-if="resultado" class="text-center py-2">
          <v-chip :color="resultado.cor" size="large" class="font-weight-bold">{{ resultado.texto }}</v-chip>
          <p v-if="minhaAposta" class="text-caption text-medium-emphasis mt-2">
            Apostaste {{ minhaAposta.montante }} em
            {{ minhaAposta.alvo_id === jogador1?.id ? jogador1?.name : jogador2?.name }}.
          </p>
        </div>

        <!-- Apostas fechadas (jogo a decorrer) -->
        <div v-else-if="!apostasAbertas" class="text-center py-2">
          <template v-if="minhaAposta">
            <v-icon color="primary" class="mb-1">mdi-lock</v-icon>
            <p class="text-body-2">
              Apostaste <strong>{{ minhaAposta.montante }}</strong> em
              <strong>{{ minhaAposta.alvo_id === jogador1?.id ? jogador1?.name : jogador2?.name }}</strong>.
            </p>
            <p class="text-caption text-medium-emphasis">Boa sorte! 🤞</p>
          </template>
          <p v-else class="text-body-2 text-medium-emphasis">As apostas fecharam. Não apostaste desta vez.</p>
        </div>

        <!-- Form de aposta (abertas) -->
        <template v-else>
          <!-- Escolher jogador -->
          <div class="d-flex gap-2 mb-4">
            <button
              class="alvo" :class="{ 'alvo--sel': alvo === jogador1?.id, 'alvo--blue': true, 'alvo--off': alvoFixo && alvoFixo !== jogador1?.id }"
              @click="escolherAlvo(jogador1?.id)"
            >
              <v-avatar size="40" class="ring-blue mb-1">
                <v-img v-if="jogador1?.avatar_url" :src="jogador1.avatar_url" cover />
                <span v-else class="font-weight-black text-blue">{{ jogador1?.name?.charAt(0).toUpperCase() }}</span>
              </v-avatar>
              <div class="text-body-2 font-weight-bold text-truncate">{{ jogador1?.name }}</div>
              <div class="text-caption text-medium-emphasis">quota x{{ quota(pote1).toFixed(2) }}</div>
            </button>
            <button
              class="alvo" :class="{ 'alvo--sel': alvo === jogador2?.id, 'alvo--red': true, 'alvo--off': alvoFixo && alvoFixo !== jogador2?.id }"
              @click="escolherAlvo(jogador2?.id)"
            >
              <v-avatar size="40" class="ring-red mb-1">
                <v-img v-if="jogador2?.avatar_url" :src="jogador2.avatar_url" cover />
                <span v-else class="font-weight-black text-red">{{ jogador2?.name?.charAt(0).toUpperCase() }}</span>
              </v-avatar>
              <div class="text-body-2 font-weight-bold text-truncate">{{ jogador2?.name }}</div>
              <div class="text-caption text-medium-emphasis">quota x{{ quota(pote2).toFixed(2) }}</div>
            </button>
          </div>

          <div v-if="minhaAposta" class="text-caption text-medium-emphasis mb-2">
            Já tens {{ minhaAposta.montante }} 🪙 neste jogador — podes reforçar.
          </div>

          <!-- Montante -->
          <div v-if="saldo > 0">
            <div class="d-flex align-center justify-space-between mb-1">
              <span class="text-body-2">Montante</span>
              <span class="text-body-1 font-weight-bold text-accent">{{ montante }} 🪙</span>
            </div>
            <v-slider v-model="montante" :min="1" :max="saldo" :step="1" color="accent" hide-details density="compact" class="mb-2" />
            <div class="d-flex gap-2 mb-4 flex-wrap">
              <v-chip size="small" variant="tonal" @click="setMontante(10)">10</v-chip>
              <v-chip size="small" variant="tonal" @click="setMontante(25)">25</v-chip>
              <v-chip size="small" variant="tonal" @click="setMontante(50)">50</v-chip>
              <v-chip size="small" variant="tonal" @click="setMontante(saldo)">Tudo ({{ saldo }})</v-chip>
            </div>
            <v-btn
              color="accent" size="large" rounded="lg" block
              :disabled="!alvoValido || montante < 1 || montante > saldo"
              :loading="aApostar"
              prepend-icon="mdi-cash-plus"
              @click="confirmar"
            >
              {{ alvoValido ? `Apostar ${montante} em ${nomeAlvo}` : 'Escolhe um jogador' }}
            </v-btn>
          </div>
          <p v-else class="text-center text-body-2 text-medium-emphasis py-2">Ficaste sem moedas. 😬</p>
        </template>
      </template>

      <v-snackbar :model-value="!!erro" color="error" timeout="3000" @update:model-value="erro = ''">{{ erro }}</v-snackbar>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.aposta-card { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); }

.pote-bar { display: flex; height: 26px; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.05); }
.pote-lado { display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; transition: width 0.4s ease; min-width: 0; }
.pote-blue { background: linear-gradient(90deg, rgba(0,176,255,0.5), rgba(0,176,255,0.8)); color: #001018; }
.pote-red  { background: linear-gradient(90deg, rgba(255,23,68,0.8), rgba(255,23,68,0.5)); color: #1a0006; }

.alvo {
  flex: 1; min-width: 0;
  padding: 12px 8px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s, background 0.12s;
}
.alvo:hover { transform: translateY(-2px); }
.alvo--sel.alvo--blue { border-color: #00B0FF; background: rgba(0,176,255,0.12); }
.alvo--sel.alvo--red  { border-color: #FF1744; background: rgba(255,23,68,0.12); }
.alvo--off { opacity: 0.4; pointer-events: none; }

.ring-blue { outline: 2px solid #00B0FF; outline-offset: 2px; }
.ring-red  { outline: 2px solid #FF1744; outline-offset: 2px; }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
.text-accent { color: rgb(var(--v-theme-accent)); }
</style>
