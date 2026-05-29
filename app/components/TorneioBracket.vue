<script setup lang="ts">
import type { Partida } from '~/composables/useLobby'
import type { Utilizador } from '~/types/torneio'

const props = defineProps<{
  torneioId: string
  partidas: readonly Partida[]
  faseAtual: string
  jogoAtual: string
  perfilId?: string
  perfilDe: (id: string | null) => Utilizador | null
}>()

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
            <!-- Jogador 1 (azul) -->
            <div
              class="player-row d-flex align-center gap-3 pa-2 rounded-lg"
              :class="{ 'player-row--winner': p.status === 'TERMINADO' && p.vencedor_id === p.jogador1_id }"
            >
              <v-avatar size="40" class="ring-blue">
                <v-img v-if="perfilDe(p.jogador1_id)?.avatar_url" :src="perfilDe(p.jogador1_id)!.avatar_url!" cover />
                <span v-else class="font-weight-black text-blue">{{ inicial(perfilDe(p.jogador1_id)) }}</span>
              </v-avatar>
              <span class="flex-grow-1 text-body-2 font-weight-medium text-truncate">
                {{ perfilDe(p.jogador1_id)?.name ?? '—' }}
                <v-chip v-if="souEu(p.jogador1_id)" size="x-small" color="primary" class="ml-1">Tu</v-chip>
              </span>
              <v-icon v-if="p.status === 'TERMINADO' && p.vencedor_id === p.jogador1_id" color="success">mdi-trophy</v-icon>
            </div>

            <div class="text-center text-caption text-medium-emphasis py-1">VS</div>

            <!-- Jogador 2 (vermelho) -->
            <div
              class="player-row d-flex align-center gap-3 pa-2 rounded-lg"
              :class="{ 'player-row--winner': p.status === 'TERMINADO' && p.vencedor_id === p.jogador2_id }"
            >
              <v-avatar size="40" class="ring-red">
                <v-img v-if="perfilDe(p.jogador2_id)?.avatar_url" :src="perfilDe(p.jogador2_id)!.avatar_url!" cover />
                <span v-else class="font-weight-black text-red">{{ p.jogador2_id ? inicial(perfilDe(p.jogador2_id)) : '—' }}</span>
              </v-avatar>
              <span class="flex-grow-1 text-body-2 font-weight-medium text-truncate">
                {{ p.jogador2_id ? (perfilDe(p.jogador2_id)?.name ?? '—') : 'Passa automaticamente' }}
                <v-chip v-if="souEu(p.jogador2_id)" size="x-small" color="primary" class="ml-1">Tu</v-chip>
              </span>
              <v-icon v-if="p.status === 'TERMINADO' && p.vencedor_id === p.jogador2_id" color="success">mdi-trophy</v-icon>
            </div>

            <!-- Ação -->
            <div class="mt-3">
              <v-btn
                v-if="p.status === 'A_JOGAR' && (souEu(p.jogador1_id) || souEu(p.jogador2_id))"
                color="secondary" block rounded="lg"
                prepend-icon="mdi-play"
                :to="`/torneio/${torneioId}/partida/${p.id}`"
              >
                Jogar
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

.player-row { transition: background 0.2s; }
.player-row--winner { background: rgba(0,230,118,0.1); }

.ring-blue { outline: 2px solid #00B0FF; outline-offset: 2px; background: rgba(0,176,255,0.15); }
.ring-red  { outline: 2px solid #FF1744; outline-offset: 2px; background: rgba(255,23,68,0.15); }
.text-blue { color: #40C4FF; }
.text-red  { color: #FF5252; }
</style>
