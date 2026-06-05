<script setup lang="ts">
import type { Partida } from '~/composables/useLobby'
import type { Utilizador } from '~/types/torneio'

const props = defineProps<{
  torneioId: string
  partidas: readonly Partida[]
  faseAtual: string
  jogoAtual: string
  perfilId?: string
  isAdmin?: boolean
  emJogo?: boolean
  destaqueId?: string | null
  bloquearTroca?: boolean
  perfilDe: (id: string | null) => Utilizador | null
}>()

const emit = defineEmits<{ destacar: [partidaId: string] }>()

function inicial(u: Utilizador | null) {
  return u?.name?.charAt(0).toUpperCase() ?? '?'
}
function souEu(id: string | null) {
  return !!id && id === props.perfilId
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap gap-2 mb-5">
      <v-chip color="secondary" size="small" label>
        <v-icon start size="14">mdi-sword-cross</v-icon>{{ faseAtual }}
      </v-chip>
      <v-chip size="small" variant="tonal" color="primary">
        <v-icon start size="14">mdi-controller-classic</v-icon>{{ jogoAtual }}
      </v-chip>
    </div>

    <v-row>
      <v-col
        v-for="p in partidas"
        :key="p.id"
        cols="12" sm="6"
      >
        <v-card
          rounded="xl" elevation="0"
          class="match-card"
          :class="{ 'match-card--done': p.status === 'TERMINADO', 'match-card--mine': souEu(p.jogador1_id) || souEu(p.jogador2_id) }"
        >
          <v-card-text class="pa-4">
            <!-- Confronto frente-a-frente -->
            <div class="d-flex align-stretch">
              <!-- Jogador 1 (azul) -->
              <div
                class="lado pa-2 rounded-lg"
                :class="{ 'lado--winner': p.status === 'TERMINADO' && p.vencedor_id === p.jogador1_id }"
              >
                <v-avatar size="48" class="ring-blue mb-2">
                  <v-img v-if="perfilDe(p.jogador1_id)?.avatar_url" :src="perfilDe(p.jogador1_id)!.avatar_url!" cover />
                  <span v-else class="font-weight-black text-blue">{{ inicial(perfilDe(p.jogador1_id)) }}</span>
                </v-avatar>
                <div class="text-body-2 font-weight-medium text-truncate w-100">
                  {{ perfilDe(p.jogador1_id)?.name ?? '—' }}
                </div>
                <v-chip v-if="souEu(p.jogador1_id)" size="x-small" color="primary" class="mt-1">Tu</v-chip>
                <v-icon v-if="p.status === 'TERMINADO' && p.vencedor_id === p.jogador1_id" color="success" size="18" class="mt-1">mdi-trophy</v-icon>
              </div>

              <!-- VS -->
              <div class="vs-sep">VS</div>

              <!-- Jogador 2 (vermelho) -->
              <div
                class="lado pa-2 rounded-lg"
                :class="{ 'lado--winner': p.status === 'TERMINADO' && p.vencedor_id === p.jogador2_id }"
              >
                <v-avatar size="48" class="ring-red mb-2">
                  <v-img v-if="perfilDe(p.jogador2_id)?.avatar_url" :src="perfilDe(p.jogador2_id)!.avatar_url!" cover />
                  <span v-else class="font-weight-black text-red">{{ p.jogador2_id ? inicial(perfilDe(p.jogador2_id)) : '—' }}</span>
                </v-avatar>
                <div class="text-body-2 font-weight-medium text-truncate w-100">
                  {{ p.jogador2_id ? (perfilDe(p.jogador2_id)?.name ?? '—') : 'Bye' }}
                </div>
                <v-chip v-if="souEu(p.jogador2_id)" size="x-small" color="primary" class="mt-1">Tu</v-chip>
                <v-icon v-if="p.status === 'TERMINADO' && p.vencedor_id === p.jogador2_id" color="success" size="18" class="mt-1">mdi-trophy</v-icon>
              </div>
            </div>

            <!-- Ação — só disponível depois de "Começar jogos" (emJogo) -->
            <div class="mt-3">
              <template v-if="emJogo">
                <v-btn
                  v-if="p.status === 'A_JOGAR' && (souEu(p.jogador1_id) || souEu(p.jogador2_id))"
                  color="secondary" block rounded="lg"
                  prepend-icon="mdi-play"
                  :to="`/torneio/${torneioId}/partida/${p.id}`"
                >
                  Jogar
                </v-btn>
                <v-btn
                  v-else-if="p.status === 'A_JOGAR' && isAdmin"
                  color="secondary" variant="tonal" block rounded="lg"
                  prepend-icon="mdi-gamepad-variant"
                  :to="`/torneio/${torneioId}/partida/${p.id}`"
                >
                  Controlar
                </v-btn>
                <v-btn
                  v-else-if="p.status === 'A_JOGAR'"
                  variant="tonal" block rounded="lg"
                  prepend-icon="mdi-eye-outline"
                  :to="`/torneio/${torneioId}/partida/${p.id}`"
                >
                  Assistir
                </v-btn>
                <div v-else class="text-center text-caption text-success">
                  <v-icon size="14" start>mdi-check-circle</v-icon>Terminada
                </div>

                <!-- Apresentar no projetor (admin) -->
                <v-btn
                  v-if="isAdmin && p.status === 'A_JOGAR'"
                  :variant="destaqueId === p.id ? 'flat' : 'text'"
                  :color="destaqueId === p.id ? 'accent' : 'primary'"
                  size="small" block rounded="lg" class="mt-2"
                  :prepend-icon="destaqueId === p.id ? 'mdi-television-shimmer' : 'mdi-television-play'"
                  :disabled="bloquearTroca && destaqueId !== p.id"
                  :title="bloquearTroca && destaqueId !== p.id ? 'Termina a partida em palco primeiro' : ''"
                  @click="emit('destacar', p.id)"
                >
                  {{ destaqueId === p.id ? 'No projetor' : 'Apresentar' }}
                </v-btn>
              </template>

              <!-- Fase ARVORE: confrontos revelados mas jogos ainda não começaram -->
              <template v-else>
                <div v-if="p.status === 'TERMINADO'" class="text-center text-caption text-success">
                  <v-icon size="14" start>mdi-check-circle</v-icon>Terminada
                </div>
              </template>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.match-card {
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
}
.match-card--mine { border-color: rgba(0,229,255,0.35); }
.match-card--done { opacity: 0.85; }

.lado {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: background 0.2s;
}
.lado--winner { background: rgba(0,230,118,0.12); }

.vs-sep {
  align-self: center;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.45);
  padding: 0 8px;
  flex-shrink: 0;
}

.ring-blue { outline: 2px solid #00B0FF; outline-offset: 2px; background: rgba(0,176,255,0.15); }
.ring-red  { outline: 2px solid #FF1744; outline-offset: 2px; background: rgba(255,23,68,0.15); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
</style>
