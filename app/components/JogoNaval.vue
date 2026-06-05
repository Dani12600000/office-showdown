<script setup lang="ts">
import confetti from 'canvas-confetti'
import { NAVIOS_NAVAL } from '~/composables/usePartidaNaval'

const props = defineProps<{ partidaId: string; comoId: string | null }>()
const comoRef = computed(() => props.comoId)

const {
  jogador1, jogador2, loading,
  controlo1, controlo2, souEspectador,
  fase, vez, souSlot,
  prontoEu, prontoOponente,
  minhaGrelha, grelhaInimiga,
  meusRestantes, inimigoRestantes,
  minhaVez, jogadorDaVez, idDaJogada, ultimo,
  meuNavioEm,
  terminada, vencedor, venci, perdi,
  emDestaque, apostasAbertas, podeJogar, revelando, vitoriaVisivel,
  carregar, submeterPosicao, disparar,
} = usePartidaNaval(props.partidaId, comoRef)

const mostrarControlos = computed(() => podeJogar.value)
await carregar()

const introKey = `intro-visto-${props.partidaId}`
const introVisivel = ref(false)

function mostrarIntroSeNecessario() {
  if (emDestaque.value && !sessionStorage.getItem(introKey)) {
    introVisivel.value = true
  }
}

onMounted(() => mostrarIntroSeNecessario())
watch(emDestaque, (v) => { if (v) mostrarIntroSeNecessario() })
function introFinalizada() { introVisivel.value = false; sessionStorage.setItem(introKey, '1') }

const erro = ref('')
const minhaCor = computed<'blue' | 'red'>(() => (souSlot.value === 2 ? 'red' : 'blue'))
const torneioId = useRoute().params.id as string

// ============ FASE: POSICIONAR ============
const NAVIOS = NAVIOS_NAVAL
const orientacao = ref<'H' | 'V'>('H')
const selecionadoId = ref<string | null>(NAVIOS[0].id)
const colocados = ref<Record<string, number[]>>({})
const hoverAnchor = ref<number | null>(null)
const aSubmeter = ref(false)

const ocupadas = computed(() => new Set(Object.values(colocados.value).flat()))
const navioSel = computed(() => NAVIOS.find(n => n.id === selecionadoId.value) ?? null)
const tudoColocado = computed(() => NAVIOS.every(n => colocados.value[n.id]))

function cellsDe(anchor: number, tamanho: number, orient: 'H' | 'V'): number[] | null {
  const r = Math.floor(anchor / 5), c = anchor % 5
  const out: number[] = []
  if (orient === 'H') {
    if (c + tamanho > 5) return null
    for (let i = 0; i < tamanho; i++) out.push(anchor + i)
  } else {
    if (r + tamanho > 5) return null
    for (let i = 0; i < tamanho; i++) out.push(anchor + i * 5)
  }
  return out
}

const previewCells = computed<number[]>(() => {
  if (hoverAnchor.value == null || !navioSel.value) return []
  const cells = cellsDe(hoverAnchor.value, navioSel.value.tamanho, orientacao.value)
  if (!cells || cells.some(c => ocupadas.value.has(c))) return []
  return cells
})

function navioEm(pos: number) {
  for (const n of NAVIOS) if (colocados.value[n.id]?.includes(pos)) return n
  return null
}
function colocar(anchor: number) {
  if (!navioSel.value) return
  const cells = cellsDe(anchor, navioSel.value.tamanho, orientacao.value)
  if (!cells) { erro.value = 'O navio não cabe aí'; return }
  if (cells.some(c => ocupadas.value.has(c))) { erro.value = 'Já há um navio aí'; return }
  colocados.value = { ...colocados.value, [navioSel.value.id]: cells }
  const next = NAVIOS.find(n => !colocados.value[n.id])
  selecionadoId.value = next ? next.id : null
}
function removerEm(pos: number) {
  const n = navioEm(pos)
  if (!n) return
  const cp = { ...colocados.value }; delete cp[n.id]; colocados.value = cp
  selecionadoId.value = n.id
}
function limpar() { colocados.value = {}; selecionadoId.value = NAVIOS[0].id }
function aleatorio() {
  const novo: Record<string, number[]> = {}
  const occ = new Set<number>()
  for (const n of NAVIOS) {
    let ok = false, tent = 0
    while (!ok && tent < 500) {
      tent++
      const orient = Math.random() < 0.5 ? 'H' : 'V'
      const cells = cellsDe(Math.floor(Math.random() * 25), n.tamanho, orient)
      if (!cells || cells.some(c => occ.has(c))) continue
      cells.forEach(c => occ.add(c)); novo[n.id] = cells; ok = true
    }
  }
  colocados.value = novo
  selecionadoId.value = null
}
async function submeter() {
  if (!tudoColocado.value) return
  aSubmeter.value = true; erro.value = ''
  try { await submeterPosicao(NAVIOS.map(n => colocados.value[n.id])) }
  catch (e: any) { erro.value = e.message }
  finally { aSubmeter.value = false }
}

// ============ FASE: COMBATE ============
const aJogar = ref(false)
const podeDisparar = (pos: number) =>
  fase.value === 'COMBATE' && mostrarControlos.value && minhaVez.value && !revelando.value &&
  !terminada.value && !souEspectador.value && grelhaInimiga.value[pos] == null && !aJogar.value

async function atacar(pos: number) {
  if (!podeDisparar(pos)) return
  aJogar.value = true; erro.value = ''
  try { await disparar(pos, idDaJogada.value ?? undefined) }
  catch (e: any) { erro.value = e.message }
  finally { aJogar.value = false }
}

watch(terminada, (fim) => {
  if (fim && venci.value) {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } })
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } }), 400)
  }
})

const textoUltimo = computed(() => {
  const u = ultimo.value
  if (!u) return null
  if (u.resultado === 'afundou') return u.por === souSlot.value ? 'Afundaste um navio! 💥' : 'Afundou um navio teu!'
  if (u.resultado === 'acerto') return u.por === souSlot.value ? 'Acerto! 🔥' : 'Acertou num navio teu!'
  return u.por === souSlot.value ? 'Água… 🌊' : 'Falhou — água!'
})
</script>

<template>
  <IntroPartida :jogador1="jogador1" :jogador2="jogador2" :visivel="introVisivel" @done="introFinalizada" />

  <div v-if="loading" class="d-flex justify-center align-center" style="min-height:60vh">
    <v-progress-circular indeterminate color="primary" size="56" />
  </div>

  <template v-else>
    <!-- CABEÇALHO -->
    <v-card rounded="xl" elevation="0" class="placar mb-5">
      <v-card-text class="pa-5">
        <div class="d-flex align-center justify-space-between">
          <div class="text-center" style="flex:1">
            <v-avatar size="56" class="ring-blue mb-2" :class="{ 'glow-on': fase === 'COMBATE' && vez === 1 && !terminada }">
              <v-img v-if="jogador1?.avatar_url" :src="jogador1.avatar_url" cover />
              <span v-else class="text-h6 font-weight-black text-blue">{{ jogador1?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">{{ jogador1?.name }}</div>
          </div>
          <div class="text-center px-3">
            <v-chip v-if="terminada" color="accent" size="small" class="font-weight-bold">
              <v-icon start size="14">mdi-trophy</v-icon>{{ vencedor?.name }}
            </v-chip>
            <v-chip v-else-if="fase === 'POSICIONAR'" size="small" variant="tonal" color="primary">
              <v-icon start size="14">mdi-map-marker</v-icon>A posicionar
            </v-chip>
            <v-chip v-else size="small" variant="tonal" color="primary">
              <v-icon start size="14">mdi-crosshairs-gps</v-icon>Vez de {{ jogadorDaVez?.name }}
            </v-chip>
          </div>
          <div class="text-center" style="flex:1">
            <v-avatar size="56" class="ring-red mb-2" :class="{ 'glow-on': fase === 'COMBATE' && vez === 2 && !terminada }">
              <v-img v-if="jogador2?.avatar_url" :src="jogador2.avatar_url" cover />
              <span v-else class="text-h6 font-weight-black text-red">{{ jogador2?.name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
            <div class="text-body-2 font-weight-bold text-truncate">{{ jogador2?.name }}</div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- TERMINADA -->
    <div v-if="vitoriaVisivel" class="text-center py-4">
      <template v-if="venci">
        <v-icon size="72" color="accent" class="mb-2">mdi-trophy</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">Ganhaste! 🎉</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">Afundaste a frota inimiga.</p>
      </template>
      <template v-else-if="perdi">
        <v-icon size="72" color="error" class="mb-2">mdi-emoticon-sad-outline</v-icon>
        <h2 class="text-h4 font-weight-black mb-1">Perdeste</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ vencedor?.name }} afundou a tua frota. Obrigado por jogares!</p>
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

      <!-- Espectador -->
      <div v-else-if="souEspectador" class="text-center py-6">
        <v-icon size="44" color="surface-variant" class="mb-2">mdi-eye-outline</v-icon>
        <p class="text-body-2 text-medium-emphasis">Estás a assistir. Acompanha o combate no projetor.</p>
      </div>

      <!-- ============ FASE: POSICIONAR ============ -->
      <template v-else-if="fase === 'POSICIONAR'">
        <!-- Já estou pronto → à espera do adversário -->
        <div v-if="prontoEu" class="text-center py-8">
          <v-icon size="56" color="success" class="mb-3">mdi-check-circle</v-icon>
          <h3 class="text-h5 font-weight-black mb-1">Frota a postos!</h3>
          <p class="text-body-2 text-medium-emphasis">
            {{ prontoOponente ? 'A começar o combate…' : 'À espera que o adversário posicione a frota.' }}
          </p>
          <v-progress-linear indeterminate color="primary" class="mt-4" rounded style="max-width:280px;margin:0 auto" />
        </div>

        <!-- Posicionar -->
        <template v-else>
          <div class="text-center mb-3">
            <span class="text-overline" :class="`text-${minhaCor}`">Posiciona a tua frota</span>
            <p class="text-caption text-medium-emphasis">Escolhe um navio, a direção, e toca na grelha. Toca num navio para o tirar.</p>
          </div>

          <!-- Paleta de navios -->
          <div class="d-flex justify-center flex-wrap gap-2 mb-3">
            <v-chip
              v-for="n in NAVIOS" :key="n.id"
              :color="selecionadoId === n.id ? minhaCor : undefined"
              :variant="selecionadoId === n.id ? 'flat' : 'tonal'"
              :disabled="!!colocados[n.id]"
              @click="selecionadoId = n.id"
            >
              <v-icon start size="16">{{ colocados[n.id] ? 'mdi-check' : 'mdi-ferry' }}</v-icon>
              {{ n.nome }} ({{ n.tamanho }})
            </v-chip>
          </div>

          <!-- Direção + ações -->
          <div class="d-flex justify-center align-center gap-2 mb-4 flex-wrap">
            <v-btn-toggle v-model="orientacao" mandatory density="comfortable" variant="outlined" divided rounded="lg">
              <v-btn value="H" size="small"><v-icon start size="16">mdi-arrow-left-right</v-icon>Horizontal</v-btn>
              <v-btn value="V" size="small"><v-icon start size="16">mdi-arrow-up-down</v-icon>Vertical</v-btn>
            </v-btn-toggle>
            <v-btn variant="tonal" size="small" rounded="lg" prepend-icon="mdi-shuffle-variant" @click="aleatorio">Aleatório</v-btn>
            <v-btn variant="text" size="small" rounded="lg" prepend-icon="mdi-eraser" @click="limpar">Limpar</v-btn>
          </div>

          <!-- Grelha de colocação -->
          <div class="grelha-wrap mb-5">
            <div class="grelha">
              <button
                v-for="i in 25" :key="'pl-' + (i - 1)"
                class="casa"
                :class="{
                  'casa--navio-meu': navioEm(i - 1),
                  'casa--preview': previewCells.includes(i - 1),
                }"
                :data-cor="minhaCor"
                @mouseenter="hoverAnchor = i - 1"
                @mouseleave="hoverAnchor = null"
                @click="navioEm(i - 1) ? removerEm(i - 1) : colocar(i - 1)"
              >
                <v-icon v-if="navioEm(i - 1)" :color="minhaCor === 'blue' ? '#40C4FF' : '#FF5252'" size="22">mdi-ferry</v-icon>
              </button>
            </div>
          </div>

          <div class="text-center">
            <v-btn
              color="secondary" size="large" rounded="lg" block
              prepend-icon="mdi-check-bold"
              :disabled="!tudoColocado"
              :loading="aSubmeter"
              @click="submeter"
            >
              {{ tudoColocado ? 'Pronto — confirmar frota' : 'Coloca todos os navios' }}
            </v-btn>
          </div>
        </template>
      </template>

      <!-- ============ FASE: COMBATE ============ -->
      <template v-else>
        <div class="text-center mb-2">
          <span class="text-overline" :class="`text-${minhaCor}`">Ataca o inimigo</span>
          <div class="text-caption text-medium-emphasis">
            <v-icon size="13">mdi-ferry</v-icon> {{ inimigoRestantes }} casas de navio por afundar
          </div>
        </div>
        <div class="grelha-wrap mb-5">
          <div class="grelha grelha--ataque">
            <button
              v-for="i in 25" :key="'atk-' + (i - 1)"
              class="casa"
              :class="{
                'casa--alvo': podeDisparar(i - 1),
                'casa--acerto': grelhaInimiga[i - 1] === 'acerto',
                'casa--agua': grelhaInimiga[i - 1] === 'agua',
              }"
              :disabled="!podeDisparar(i - 1)"
              @click="atacar(i - 1)"
            >
              <v-icon v-if="grelhaInimiga[i - 1] === 'acerto'" color="deep-orange" size="22">mdi-fire</v-icon>
              <v-icon v-else-if="grelhaInimiga[i - 1] === 'agua'" color="blue" size="16">mdi-circle-outline</v-icon>
              <v-icon v-else-if="podeDisparar(i - 1)" size="18" class="alvo-icon">mdi-crosshairs</v-icon>
            </button>
          </div>
        </div>

        <div class="text-center mb-5" style="min-height:24px">
          <p v-if="revelando" class="text-body-2 text-medium-emphasis"><v-icon size="16">mdi-eye</v-icon> Revelação…</p>
          <p v-else-if="minhaVez" class="text-body-1 font-weight-bold" :class="`text-${minhaCor}`">É a tua vez — dispara numa casa inimiga!</p>
          <p v-else class="text-body-2 text-medium-emphasis">
            <span v-if="textoUltimo">{{ textoUltimo }} · </span>A pensar… ({{ jogadorDaVez?.name }})
          </p>
        </div>

        <div class="text-center mb-2">
          <span class="text-overline text-medium-emphasis">A tua frota</span>
          <div class="text-caption text-medium-emphasis">
            <v-icon size="13">mdi-shield</v-icon> {{ meusRestantes }} casas intactas
          </div>
        </div>
        <div class="grelha-wrap">
          <div class="grelha grelha--frota">
            <div
              v-for="i in 25" :key="'def-' + (i - 1)"
              class="casa"
              :class="{
                'casa--navio-meu': meuNavioEm(i - 1) && minhaGrelha[i - 1] !== 'acerto',
                'casa--navio-atingido': meuNavioEm(i - 1) && minhaGrelha[i - 1] === 'acerto',
                'casa--agua': !meuNavioEm(i - 1) && minhaGrelha[i - 1] === 'agua',
              }"
              :data-cor="minhaCor"
            >
              <v-icon v-if="meuNavioEm(i - 1) && minhaGrelha[i - 1] === 'acerto'" color="deep-orange" size="22">mdi-fire</v-icon>
              <v-icon v-else-if="meuNavioEm(i - 1)" :color="minhaCor === 'blue' ? '#40C4FF' : '#FF5252'" size="20">mdi-ferry</v-icon>
              <v-icon v-else-if="minhaGrelha[i - 1] === 'agua'" color="blue" size="14">mdi-circle-outline</v-icon>
            </div>
          </div>
        </div>
      </template>
    </template>

    <v-snackbar :model-value="!!erro" color="error" timeout="3000" @update:model-value="erro = ''">
      {{ erro }}
    </v-snackbar>
  </template>
</template>

<style scoped>
.placar { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }

.ring-blue { outline: 3px solid #00B0FF; outline-offset: 2px; background: rgba(0,176,255,0.15); box-shadow: 0 0 14px rgba(0,176,255,0.4); }
.ring-red  { outline: 3px solid #FF1744; outline-offset: 2px; background: rgba(255,23,68,0.15); box-shadow: 0 0 14px rgba(255,23,68,0.4); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }

.glow-on { animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse {
  0%,100% { box-shadow: 0 0 16px rgba(255,255,255,0.2); }
  50%     { box-shadow: 0 0 32px rgba(0,229,255,0.7); }
}

.grelha-wrap { display: flex; justify-content: center; }
.grelha {
  display: grid;
  grid-template-columns: repeat(5, 52px);
  grid-template-rows: repeat(5, 52px);
  gap: 6px;
  padding: 10px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(0,60,110,0.25), rgba(0,30,70,0.35));
  border: 1px solid rgba(0,176,255,0.22);
}
@media (max-width: 400px) {
  .grelha { grid-template-columns: repeat(5, 44px); grid-template-rows: repeat(5, 44px); }
}

.casa {
  border-radius: 10px;
  background: rgba(13,13,26,0.55);
  border: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}
button.casa { cursor: pointer; transition: transform 0.1s, border-color 0.1s, background 0.1s; }
button.casa:disabled { cursor: default; }

.casa--alvo:hover { transform: scale(1.06); border-color: rgb(var(--v-theme-primary)); background: rgba(0,229,255,0.1); }
.alvo-icon { opacity: 0.25; }
.casa--alvo:hover .alvo-icon { opacity: 0.7; }

.casa--acerto { background: rgba(255,87,34,0.18); border-color: rgba(255,87,34,0.5); }
.casa--agua { background: rgba(0,176,255,0.08); }

.casa--navio-meu { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); }
.casa--navio-meu[data-cor="blue"] { border-color: rgba(0,176,255,0.5); background: rgba(0,176,255,0.1); }
.casa--navio-meu[data-cor="red"]  { border-color: rgba(255,23,68,0.5); background: rgba(255,23,68,0.1); }
.casa--navio-atingido { background: rgba(255,87,34,0.22); border-color: rgba(255,87,34,0.6); }
.casa--preview { border-color: rgba(0,229,255,0.7); background: rgba(0,229,255,0.14); }
</style>
