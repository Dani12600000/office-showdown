<script setup lang="ts">
// Página PÚBLICA de partilha do resultado (sem login — NÃO declara o middleware 'auth').
// Lê os dados via RPC `resultado_publico` (security definer → acessível a anónimos),
// para que o WhatsApp/Facebook consigam gerar a pré-visualização ao partilhar o link.
import type { Database } from '~/types/database.types'

definePageMeta({ layout: false })

const route = useRoute()
const torneioId = route.params.id as string
const supabase = useSupabaseClient<Database>()
const url = useRequestURL()

const { data: res } = await useAsyncData(`resultado-${torneioId}`, async () => {
  const { data, error } = await (supabase as any).rpc('resultado_publico', { p_torneio_id: torneioId })
  if (error) { console.error('[resultado] RPC erro:', error.message); return null }
  return data as {
    nome: string | null
    status: string | null
    campeao: { id: string; name: string; avatar_url: string | null } | null
    melhor: { name: string; avatar_url: string | null; ganho: number } | null
  } | null
})

const nome     = computed(() => res.value?.nome ?? 'Torneio')
const campeao  = computed(() => res.value?.campeao ?? null)
const melhor   = computed(() => res.value?.melhor ?? null)
const terminado = computed(() => res.value?.status === 'FINAL')

const inicial = (n?: string | null) => (n ?? '?').charAt(0).toUpperCase()

// ---- SEO / partilha ----
const titulo = computed(() =>
  terminado.value && campeao.value
    ? `🏆 ${campeao.value.name} venceu o ${nome.value}!`
    : `${nome.value} — Office Showdown`,
)
const descricao = computed(() =>
  terminado.value && campeao.value
    ? (melhor.value
        ? `Maior apostador: ${melhor.value.name} (+${melhor.value.ganho} 🪙). Vê o resultado completo.`
        : 'Vê o resultado completo do torneio.')
    : 'Torneios + game show ao vivo no escritório.',
)

useSeoMeta({
  title: titulo,
  ogTitle: titulo,
  description: descricao,
  ogDescription: descricao,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

defineOgImageComponent('Campeao', {
  nome: campeao.value?.name ?? '',
  torneio: nome.value,
  avatar: campeao.value?.avatar_url ?? null,
  apostador: melhor.value?.name ?? null,
  apostadorAvatar: melhor.value?.avatar_url ?? null,
  apostadorGanho: melhor.value?.ganho ?? null,
})

// ---- Botões de partilha ----
const urlAtual = computed(() => `${url.origin}/torneio/${torneioId}/resultado`)
const copiado = ref(false)

const textoPartilha = computed(() => {
  let t = terminado.value && campeao.value
    ? `🏆 ${campeao.value.name} venceu o "${nome.value}" no Office Showdown!`
    : `${nome.value} no Office Showdown`
  if (melhor.value) t += ` 🪙 Melhor apostador: ${melhor.value.name} (+${melhor.value.ganho}).`
  return t
})

async function partilhar() {
  const dados = { title: 'Office Showdown', text: textoPartilha.value, url: urlAtual.value }
  if (import.meta.client && navigator.share) {
    try { await navigator.share(dados) } catch { /* cancelado */ }
    return
  }
  try {
    await navigator.clipboard.writeText(`${textoPartilha.value} ${urlAtual.value}`)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2500)
  } catch { /* sem permissão */ }
}
function partilharWhatsApp() {
  const txt = encodeURIComponent(`${textoPartilha.value} ${urlAtual.value}`)
  window.open(`https://wa.me/?text=${txt}`, '_blank')
}
</script>

<template>
  <div class="resultado-bg">
    <div class="resultado-card">
      <LogoShowdown class="mb-6" />

      <template v-if="terminado && campeao">
        <v-icon size="64" color="accent" class="mb-2">mdi-trophy</v-icon>
        <p class="text-overline text-medium-emphasis" style="letter-spacing:4px !important">Campeão</p>
        <v-avatar size="180" color="primary" class="champion-glow my-5">
          <v-img v-if="campeao.avatar_url" :src="campeao.avatar_url" cover />
          <span v-else class="font-weight-black text-surface" style="font-size:4.5rem">{{ inicial(campeao.name) }}</span>
        </v-avatar>
        <h1 class="font-weight-black mb-1" style="font-size:3.4rem; line-height:1.05">{{ campeao.name }}</h1>
        <p class="text-h6 text-medium-emphasis mb-2">{{ nome }}</p>

        <div v-if="melhor" class="podio mt-6">
          <div class="podio-card">
            <p class="text-overline text-medium-emphasis mb-2">🪙 Maior apostador</p>
            <v-avatar size="72" color="secondary" class="apostador-glow mb-2">
              <v-img v-if="melhor.avatar_url" :src="melhor.avatar_url" cover />
              <span v-else class="font-weight-black text-surface text-h5">{{ inicial(melhor.name) }}</span>
            </v-avatar>
            <p class="text-h6 font-weight-black mb-0">{{ melhor.name }}</p>
            <p class="text-body-2 text-success mb-0">+{{ melhor.ganho }} 🪙 de lucro</p>
          </div>
        </div>
      </template>

      <template v-else>
        <v-icon size="64" color="primary" class="mb-3">mdi-tournament</v-icon>
        <h1 class="font-weight-black mb-2" style="font-size:2.4rem">{{ nome }}</h1>
        <p class="text-h6 text-medium-emphasis">
          {{ res ? 'Este torneio ainda está a decorrer.' : 'Torneio não encontrado.' }}
        </p>
      </template>

      <!-- Partilha -->
      <div class="mt-8">
        <div class="d-flex flex-wrap justify-center ga-2">
          <v-btn color="primary" variant="flat" rounded="pill" prepend-icon="mdi-share-variant" @click="partilhar">
            Partilhar
          </v-btn>
          <v-btn color="green" variant="tonal" rounded="pill" prepend-icon="mdi-whatsapp" @click="partilharWhatsApp">
            WhatsApp
          </v-btn>
        </div>
        <v-fade-transition>
          <p v-if="copiado" class="text-caption text-success mt-3">
            <v-icon size="14">mdi-check</v-icon> Link copiado
          </p>
        </v-fade-transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resultado-bg {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(0, 229, 255, 0.10), transparent 60%),
    radial-gradient(1200px 600px at 80% 110%, rgba(255, 23, 68, 0.10), transparent 60%),
    #0D0D1A;
}
.resultado-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 720px;
  width: 100%;
}
.champion-glow {
  box-shadow: 0 0 70px rgba(255, 214, 0, 0.6);
  outline: 4px solid rgb(var(--v-theme-accent));
  outline-offset: 4px;
}
.podio {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}
.podio-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  padding: 18px 24px;
  min-width: 220px;
}
.apostador-glow {
  outline: 2px solid rgb(var(--v-theme-secondary));
  outline-offset: 2px;
  box-shadow: 0 0 24px rgba(255, 23, 68, 0.45);
}
</style>
