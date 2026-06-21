<script setup lang="ts">
import type { Aposta, Utilizador } from '~/types/torneio'

// Carteira do jogador: saldo de moedas + as últimas apostas e o seu resultado.
// Útil para mostrar enquanto se espera pela própria partida.
const props = defineProps<{
  saldo: number
  apostas: readonly Aposta[]
  perfilDe: (id: string | null) => Utilizador | null
}>()

// Mais recentes primeiro (máx. 5)
const ultimas = computed(() =>
  [...props.apostas]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 5)
)

function resultado(a: Aposta) {
  if (!a.liquidada) return { txt: `${a.montante} 🪙 em jogo`, cor: 'primary', icon: 'mdi-timer-sand' }
  if (a.ganho > 0)  return { txt: `+${a.ganho} 🪙`, cor: 'success', icon: 'mdi-trophy' }
  if (a.ganho < 0)  return { txt: `−${a.montante} 🪙`, cor: 'error', icon: 'mdi-close-circle' }
  return { txt: 'Reembolso', cor: 'surface-variant', icon: 'mdi-cash-refund' }
}
function inicial(u: Utilizador | null) { return u?.name?.charAt(0).toUpperCase() ?? '?' }
</script>

<template>
  <v-card rounded="xl" variant="tonal" class="carteira mt-4">
    <v-card-text class="pa-4">
      <!-- Saldo -->
      <div class="d-flex align-center justify-space-between">
        <span class="text-overline text-medium-emphasis">A tua carteira</span>
        <v-chip color="accent" variant="flat" size="large" class="font-weight-black">
          <v-icon start>mdi-circle-multiple</v-icon>{{ saldo }} 🪙
        </v-chip>
      </div>

      <template v-if="ultimas.length">
        <p class="text-caption text-medium-emphasis mt-3 mb-1">Últimas apostas</p>
        <div v-for="a in ultimas" :key="a.id" class="d-flex align-center gap-3 py-2 aposta-linha">
          <v-avatar size="34" color="surface-variant">
            <v-img v-if="perfilDe(a.alvo_id)?.avatar_url" :src="perfilDe(a.alvo_id)!.avatar_url!" cover />
            <span v-else class="text-caption font-weight-black">{{ inicial(perfilDe(a.alvo_id)) }}</span>
          </v-avatar>
          <div class="flex-grow-1 carteira-info">
            <div class="text-body-2 font-weight-bold text-truncate">{{ perfilDe(a.alvo_id)?.name ?? '—' }}</div>
            <div class="text-caption text-medium-emphasis">Apostaste {{ a.montante }} 🪙</div>
          </div>
          <v-chip :color="resultado(a).cor" size="small" variant="tonal" class="font-weight-bold flex-shrink-0">
            <v-icon start size="14">{{ resultado(a).icon }}</v-icon>{{ resultado(a).txt }}
          </v-chip>
        </div>
      </template>
      <p v-else class="text-body-2 text-medium-emphasis text-center py-3 mb-0">
        Ainda não apostaste. Quando houver um confronto no palco, podes apostar! 🪙
      </p>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.carteira { border: 1px solid rgba(255,255,255,0.08); }
.carteira-info { min-width: 0; }
.aposta-linha { border-top: 1px solid rgba(255,255,255,0.06); }
.aposta-linha:first-of-type { border-top: none; }
</style>
