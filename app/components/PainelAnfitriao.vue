<script setup lang="ts">
// Painel de controlo do ANFITRIÃO (admin) — visão total do torneio a meio do jogo:
// ouro de cada participante, papel, aposta na partida em destaque e lucro acumulado.
import type { ParticipanteLobby, Partida } from '~/composables/useLobby'
import type { Aposta, Utilizador } from '~/types/torneio'

const props = withDefaults(defineProps<{
  participantes: ParticipanteLobby[]
  apostas: Aposta[]
  partidaDestaque: Partida | null
  perfilDe: (id: string | null) => Utilizador | null
  // Total de prémios de partida (pote ganho por venceres sem ninguém apostar em ti)
  premioDe?: (utilizadorId: string) => number
  // Apostadores que já se marcaram "prontos" (Presence) — só relevante com apostas abertas
  prontos?: number
  totalProntos?: number
  apostasAbertas?: boolean
}>(), { premioDe: () => 0, prontos: 0, totalProntos: 0, apostasAbertas: false })

const aberto = ref(true)

const apostaNaDestaque = (utilizadorId: string): Aposta | null =>
  props.partidaDestaque
    ? props.apostas.find(a => a.partida_id === props.partidaDestaque!.id && a.apostador_id === utilizadorId) ?? null
    : null

// Lucro líquido acumulado (apostas já liquidadas)
const lucroDe = (utilizadorId: string) =>
  props.apostas
    .filter(a => a.apostador_id === utilizadorId && a.liquidada)
    .reduce((s, a) => s + a.ganho, 0)

const papelDe = (p: ParticipanteLobby) => {
  switch (p.status_inscricao) {
    case 'JOGADOR_CONFIRMADO': return { txt: 'Jogador', cor: 'success', icon: 'mdi-sword-cross' }
    case 'PLATEIA':            return { txt: 'Plateia', cor: 'primary', icon: 'mdi-eye' }
    default:                   return { txt: 'A decidir', cor: 'warning', icon: 'mdi-help-circle-outline' }
  }
}

// Linhas ordenadas por ouro (mais rico primeiro)
const linhas = computed(() =>
  props.participantes
    .map(p => ({
      id: p.id,
      u: p.utilizador,
      moedas: p.moedas,
      aposta: apostaNaDestaque(p.utilizador_id),
      lucro: lucroDe(p.utilizador_id),
      premio: props.premioDe(p.utilizador_id),
      papel: papelDe(p),
    }))
    .sort((a, b) => b.moedas - a.moedas),
)

const ouroTotal = computed(() => props.participantes.reduce((s, p) => s + p.moedas, 0))
const nApostasDestaque = computed(() =>
  props.partidaDestaque
    ? props.apostas.filter(a => a.partida_id === props.partidaDestaque!.id).length
    : 0,
)
const poteDestaque = computed(() =>
  props.partidaDestaque
    ? props.apostas.filter(a => a.partida_id === props.partidaDestaque!.id).reduce((s, a) => s + a.montante, 0)
    : 0,
)

const inicial = (n?: string | null) => (n ?? '?').charAt(0).toUpperCase()
const nomeAlvo = (id: string | null) => props.perfilDe(id)?.name ?? '—'
</script>

<template>
  <v-card rounded="xl" variant="tonal" class="mb-5 painel">
    <!-- Cabeçalho / resumo -->
    <div class="painel-head" @click="aberto = !aberto">
      <div class="d-flex align-center ga-2 flex-grow-1">
        <v-icon color="primary">mdi-view-dashboard-variant</v-icon>
        <span class="text-subtitle-1 font-weight-bold">Painel de controlo</span>
        <v-chip size="x-small" variant="tonal" color="primary" class="ml-1">{{ participantes.length }}</v-chip>
      </div>

      <div class="d-flex align-center ga-2 flex-wrap justify-end painel-chips">
        <v-chip size="small" color="accent" variant="flat" class="font-weight-bold">
          {{ ouroTotal }} 🪙 em jogo
        </v-chip>
        <v-chip v-if="partidaDestaque" size="small" variant="tonal" color="secondary">
          Pote: {{ poteDestaque }} 🪙 · {{ nApostasDestaque }} apostas
        </v-chip>
        <v-chip
          v-if="apostasAbertas && totalProntos > 0"
          size="small" variant="flat"
          :color="prontos >= totalProntos ? 'success' : 'warning'"
        >
          <v-icon start size="14">mdi-hand-back-right</v-icon>{{ prontos }}/{{ totalProntos }} prontos
        </v-chip>
        <v-icon>{{ aberto ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
      </div>
    </div>

    <v-expand-transition>
      <div v-show="aberto">
        <v-divider />

        <!-- Cabeçalho da tabela -->
        <div class="linha cabecalho text-caption text-medium-emphasis">
          <div class="col-jog">Participante</div>
          <div class="col-ouro text-right">Ouro</div>
          <div class="col-aposta">Aposta atual</div>
          <div class="col-lucro text-right">Lucro</div>
        </div>
        <v-divider />

        <div class="corpo">
          <div v-for="(l, i) in linhas" :key="l.id" class="linha" :class="{ alt: i % 2 === 1 }">
            <!-- Participante -->
            <div class="col-jog d-flex align-center ga-3 min-w-0">
              <v-avatar size="36" color="surface-variant">
                <v-img v-if="l.u?.avatar_url" :src="l.u.avatar_url" cover />
                <span v-else class="font-weight-bold">{{ inicial(l.u?.name) }}</span>
              </v-avatar>
              <div class="min-w-0">
                <div class="text-body-2 font-weight-bold text-truncate d-flex align-center ga-1">
                  {{ l.u?.name ?? '—' }}
                  <v-icon v-if="l.u?.is_bot" size="13" class="text-medium-emphasis">mdi-robot</v-icon>
                </div>
                <div class="d-flex align-center flex-wrap ga-1 mt-1">
                  <v-chip :color="l.papel.cor" size="x-small" variant="tonal" label>
                    <v-icon start size="11">{{ l.papel.icon }}</v-icon>{{ l.papel.txt }}
                  </v-chip>
                  <v-chip v-if="l.premio > 0" color="accent" size="x-small" variant="tonal" label title="Pote ganho por vencer sem ninguém apostar nele">
                    <v-icon start size="11">mdi-trophy</v-icon>+{{ l.premio }} 🪙 do pote
                  </v-chip>
                </div>
              </div>
            </div>

            <!-- Ouro -->
            <div class="col-ouro text-right">
              <span class="text-body-1 font-weight-black text-accent">{{ l.moedas }}</span>
              <span class="text-caption"> 🪙</span>
            </div>

            <!-- Aposta na partida em destaque -->
            <div class="col-aposta">
              <span class="m-label">Aposta:</span>
              <v-chip v-if="l.aposta" size="small" variant="tonal" color="secondary" label>
                <v-icon start size="13">mdi-cash</v-icon>
                {{ l.aposta.montante }} 🪙 → {{ nomeAlvo(l.aposta.alvo_id) }}
              </v-chip>
              <span v-else class="text-medium-emphasis text-body-2">—</span>
            </div>

            <!-- Lucro acumulado -->
            <div class="col-lucro text-right">
              <span class="m-label">Lucro:</span>
              <span
                v-if="l.lucro !== 0"
                class="text-body-2 font-weight-bold"
                :class="l.lucro > 0 ? 'text-success' : 'text-error'"
              >{{ l.lucro > 0 ? '+' : '' }}{{ l.lucro }} 🪙</span>
              <span v-else class="text-medium-emphasis text-body-2">—</span>
            </div>
          </div>

          <div v-if="!linhas.length" class="text-center text-medium-emphasis py-6">
            Sem participantes.
          </div>
        </div>
      </div>
    </v-expand-transition>
  </v-card>
</template>

<style scoped>
.painel { overflow: hidden; }
.painel-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  cursor: pointer;
  user-select: none;
}
.linha {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) 0.9fr minmax(0, 1.8fr) 0.9fr;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
}
.linha.alt { background: rgba(255, 255, 255, 0.025); }
.linha.cabecalho { padding-top: 10px; padding-bottom: 10px; font-weight: 700; }
.min-w-0 { min-width: 0; }
.corpo { max-height: 460px; overflow-y: auto; }
.corpo::-webkit-scrollbar { width: 8px; }
.corpo::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }

/* Etiquetas só visíveis no layout empilhado do mobile */
.m-label {
  display: none;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

@media (max-width: 640px) {
  /* O cabeçalho deixa de partir o título — chips passam para baixo se faltar espaço */
  .painel-head { flex-wrap: wrap; }
  .painel-head .text-subtitle-1 { white-space: nowrap; }
  .painel-chips { width: 100%; }

  /* Cada participante fica num "cartão" empilhado, com TUDO visível:
     linha 1 → nome + ouro · linha 2 → aposta · linha 3 → lucro. */
  .linha {
    grid-template-columns: 1fr auto;
    column-gap: 12px;
    row-gap: 6px;
    padding: 12px 16px;
  }
  .linha.cabecalho { display: none; }     /* os rótulos passam para dentro de cada linha */
  .col-jog    { grid-column: 1; grid-row: 1; }
  .col-ouro   { grid-column: 2; grid-row: 1; align-self: center; }
  .col-aposta {
    grid-column: 1 / -1; grid-row: 2;
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .col-lucro {
    grid-column: 1 / -1; grid-row: 3;
    text-align: left !important;
    display: flex; align-items: center; gap: 6px;
  }
  .m-label { display: inline; }
}
</style>
