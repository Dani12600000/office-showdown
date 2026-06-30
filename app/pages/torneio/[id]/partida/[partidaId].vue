<script setup lang="ts">
import { JOGOS_CATALOGO, JOGOS_RONDA_DEFAULT, type JogoTipo } from '~/types/torneio'
import type { Database } from '~/types/database.types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const torneioId = route.params.id as string
const partidaId = route.params.partidaId as string

// Modo personificação: ?como=<botId>
const comoId = computed(() => (route.query.como as string) || null)

const { perfil, isAdmin } = useAuth()

// Determina o tipo de jogo desta partida com 2 queries leves
// (cada componente de jogo faz a sua própria subscrição realtime).
const supabase = useSupabaseClient<Database>()
const jogoTipo = ref<JogoTipo>('PPT')
const carregado = ref(false)

// Estado mínimo para decidir se o jogador real pode ver o botão "Voltar".
const partidaStatus = ref<string | null>(null)
const j1 = ref<string | null>(null)
const j2 = ref<string | null>(null)
const destaqueId = ref<string | null>(null)

const { data: p } = await supabase
  .from('partidas')
  .select('torneio_id, ronda, status, jogador1_id, jogador2_id')
  .eq('id', partidaId)
  .single()

if (p) {
  partidaStatus.value = (p as any).status
  j1.value = (p as any).jogador1_id
  j2.value = (p as any).jogador2_id
  const { data: t } = await supabase
    .from('torneios')
    .select('jogos_ronda, partida_destaque_id')
    .eq('id', (p as any).torneio_id)
    .single()
  const config = ((t as any)?.jogos_ronda ?? JOGOS_RONDA_DEFAULT) as Record<string, JogoTipo>
  jogoTipo.value = config[String((p as any).ronda)] ?? 'PPT'
  destaqueId.value = (t as any)?.partida_destaque_id ?? null
}
carregado.value = true

// Mantém o estado fresco (o botão reaparece quando o jogo termina ou sai de destaque).
if (import.meta.client) {
  const canal = supabase
    .channel(`partida-nav-${partidaId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidas', filter: `id=eq.${partidaId}` }, (payload) => {
      partidaStatus.value = (payload.new as any).status
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'torneios', filter: `id=eq.${torneioId}` }, (payload) => {
      destaqueId.value = (payload.new as any).partida_destaque_id ?? null
    })
    .subscribe()
  onUnmounted(() => { supabase.removeChannel(canal) })
}

// O jogador real está "preso de propósito": é um dos jogadores, não é admin,
// a partida está a decorrer E em destaque. Nesse caso escondemos o botão de
// sair para não fugir do palco por engano (o sistema já o traz de volta, mas
// o flicker confunde). No fim do jogo o retorno é automático (useCorePartida).
const souJogadorEmPalco = computed(() =>
  !isAdmin.value &&
  !comoId.value &&
  (perfil.value?.id === j1.value || perfil.value?.id === j2.value) &&
  partidaStatus.value === 'A_JOGAR' &&
  destaqueId.value === partidaId
)

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
    <v-btn v-if="!souJogadorEmPalco" variant="text" size="small" prepend-icon="mdi-arrow-left" :to="`/torneio/${torneioId}`" class="mb-4 text-medium-emphasis px-1">
      Voltar ao torneio
    </v-btn>

    <div class="text-center mb-4 d-flex flex-column align-center ga-2">
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
