<script setup lang="ts">
import { JOGOS_CATALOGO, JOGOS_RONDA_DEFAULT, type JogoTipo } from '~/types/torneio'
import type { Database } from '~/types/database.types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const torneioId = route.params.id as string
const partidaId = route.params.partidaId as string

// Modo personificação: ?como=<botId>
const comoId = computed(() => (route.query.como as string) || null)

// Determina o tipo de jogo desta partida com 2 queries leves
// (cada componente de jogo faz a sua própria subscrição realtime).
const supabase = useSupabaseClient<Database>()
const jogoTipo = ref<JogoTipo>('PPT')
const carregado = ref(false)

const { data: p } = await supabase
  .from('partidas')
  .select('torneio_id, ronda')
  .eq('id', partidaId)
  .single()

if (p) {
  const { data: t } = await supabase
    .from('torneios')
    .select('jogos_ronda')
    .eq('id', (p as any).torneio_id)
    .single()
  const config = ((t as any)?.jogos_ronda ?? JOGOS_RONDA_DEFAULT) as Record<string, JogoTipo>
  jogoTipo.value = config[String((p as any).ronda)] ?? 'PPT'
}
carregado.value = true

const jogoNome = computed(() => JOGOS_CATALOGO[jogoTipo.value].nome)
const jogoDisponivel = computed(() => JOGOS_CATALOGO[jogoTipo.value].disponivel)

// Nome do bot personificado (apenas para mostrar no topo)
const nomeComo = ref<string | null>(null)
if (comoId.value) {
  const { data } = await supabase.from('profiles').select('name').eq('id', comoId.value).single()
  nomeComo.value = (data as any)?.name ?? null
}
</script>

<template>
  <v-container max-width="760" class="py-6">
    <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" :to="`/torneio/${torneioId}`" class="mb-4 text-medium-emphasis px-1">
      Voltar ao torneio
    </v-btn>

    <div class="text-center mb-4 d-flex flex-column align-center gap-2">
      <v-chip size="small" variant="tonal" color="primary">
        <v-icon start size="14">mdi-trophy-variant</v-icon>{{ jogoNome }}
      </v-chip>
      <v-chip v-if="nomeComo" size="small" color="secondary">
        <v-icon start size="14">mdi-robot</v-icon>Estás a jogar como {{ nomeComo }}
      </v-chip>
    </div>

    <!-- Jogo ainda não disponível -->
    <div v-if="!jogoDisponivel" class="text-center py-16">
      <v-icon size="64" color="surface-variant" class="mb-3">mdi-hammer-wrench</v-icon>
      <h2 class="text-h5 font-weight-bold mb-1">{{ jogoNome }}</h2>
      <p class="text-body-2 text-medium-emphasis mb-4">Este jogo ainda está em construção.</p>
      <v-btn color="primary" rounded="lg" prepend-icon="mdi-arrow-left" :to="`/torneio/${torneioId}`">
        Voltar ao torneio
      </v-btn>
    </div>

    <!-- Router de jogo -->
    <Suspense v-else>
      <JogoPPT    v-if="jogoTipo === 'PPT'"       :partida-id="partidaId" :como-id="comoId" />
      <JogoGalo   v-else-if="jogoTipo === 'GALO'"   :partida-id="partidaId" :como-id="comoId" />
      <JogoQuatro v-else-if="jogoTipo === 'QUATRO'" :partida-id="partidaId" :como-id="comoId" />
      <JogoNaval  v-else-if="jogoTipo === 'NAVAL'"  :partida-id="partidaId" :como-id="comoId" />
      <template #fallback>
        <div class="d-flex justify-center align-center" style="min-height:40vh">
          <v-progress-circular indeterminate color="primary" size="56" />
        </div>
      </template>
    </Suspense>
  </v-container>
</template>
