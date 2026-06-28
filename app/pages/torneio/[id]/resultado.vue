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

// Rasteriza o componente LogoShowdown (DOM real) para PNG, para o desenharmos no
// canvas — reutiliza o logo existente em vez de o redesenhar à mão.
const logoRef = ref<HTMLElement | null>(null)
async function rasterizarLogo(): Promise<string | null> {
  if (!import.meta.client || !logoRef.value) return null
  try {
    const { toPng } = await import('html-to-image')
    return await toPng(logoRef.value, { pixelRatio: 4, cacheBust: true })
  } catch (e) {
    console.warn('[resultado] falha a rasterizar o logo:', e)
    return null
  }
}

// Gera o cartão PNG (campeão + maior apostador + logo) para partilhar/descarregar.
// Só faz sentido quando o torneio terminou e há campeão.
async function gerarImagem(): Promise<Blob | null> {
  if (!terminado.value || !campeao.value) return null
  const logoDataUrl = await rasterizarLogo()
  return gerarCartaoResultado({
    torneio: nome.value,
    campeaoNome: campeao.value.name,
    campeaoAvatar: campeao.value.avatar_url,
    apostadorNome: melhor.value?.name ?? null,
    apostadorAvatar: melhor.value?.avatar_url ?? null,
    apostadorGanho: melhor.value?.ganho ?? null,
    logoDataUrl,
  })
}

const aGerar = ref(false)

async function partilhar() {
  if (!import.meta.client) return
  aGerar.value = true
  let blob: Blob | null = null
  try { blob = await gerarImagem() } catch { blob = null }
  aGerar.value = false

  const ficheiro = blob ? new File([blob], 'office-showdown.png', { type: 'image/png' }) : null
  // Ao partilhar ficheiro, alguns apps ignoram o campo `url` — por isso meto o link no texto.
  const textoComLink = `${textoPartilha.value} ${urlAtual.value}`

  // 1) Partilha nativa COM imagem (Web Share API nível 2)
  if (ficheiro && navigator.canShare?.({ files: [ficheiro] })) {
    try {
      await navigator.share({ title: 'Office Showdown', text: textoComLink, files: [ficheiro] })
      return
    } catch { return /* cancelado pelo utilizador */ }
  }

  // 2) Partilha nativa só com texto/link (sem suporte a ficheiros)
  if (navigator.share) {
    try { await navigator.share({ title: 'Office Showdown', text: textoPartilha.value, url: urlAtual.value }); return }
    catch { /* cancelado */ }
  }

  // 3) Fallback desktop: descarrega a imagem (se houver) e copia o texto+link
  if (blob) descarregarBlob(blob, 'office-showdown.png')
  try {
    await navigator.clipboard.writeText(textoComLink)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2500)
  } catch { /* sem permissão */ }
}

function descarregarBlob(blob: Blob, nomeFicheiro: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href; a.download = nomeFicheiro
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

const aDescarregar = ref(false)
async function descarregarImagem() {
  aDescarregar.value = true
  try {
    const blob = await gerarImagem()
    if (blob) descarregarBlob(blob, 'office-showdown.png')
  } finally { aDescarregar.value = false }
}
</script>

<template>
  <div class="resultado-bg">
    <div class="resultado-card">
      <div ref="logoRef" class="logo-wrap mb-6">
        <LogoShowdown />
      </div>

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
          <v-btn color="primary" variant="flat" rounded="pill" prepend-icon="mdi-share-variant" :loading="aGerar" @click="partilhar">
            Partilhar
          </v-btn>
          <v-btn
            v-if="terminado && campeao"
            color="primary" variant="tonal" rounded="pill" prepend-icon="mdi-image-outline"
            :loading="aDescarregar" @click="descarregarImagem"
          >
            Descarregar imagem
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
