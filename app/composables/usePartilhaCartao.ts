import type { Ref } from 'vue'
import { gerarCartaoResultado, type DadosCartao } from './useCartaoResultado'

// Lógica partilhada de partilha/descarregamento do cartão de resultado (PNG),
// usada tanto no ecrã de campeão (index.vue) como na página pública (resultado.vue).
//
// - `logoEl`: nó DOM do <LogoShowdown> a rasterizar (html-to-image) para o cartão.
// - `dados`: getter dos dados do cartão (sem o logo). Devolve null se não houver
//   campeão (ex.: torneio ainda a decorrer) — nesse caso não se gera imagem.
// - `texto` / `url`: texto e link da partilha.
export function usePartilhaCartao(opts: {
  logoEl: Ref<HTMLElement | null>
  dados: () => Omit<DadosCartao, 'logoDataUrl'> | null
  texto: () => string
  url: () => string
}) {
  const aGerar = ref(false)
  const aDescarregar = ref(false)
  const copiado = ref(false)

  async function rasterizarLogo(): Promise<string | null> {
    if (!import.meta.client || !opts.logoEl.value) return null
    try {
      const { toPng } = await import('html-to-image')
      return await toPng(opts.logoEl.value, { pixelRatio: 4, cacheBust: true })
    } catch (e) {
      console.warn('[partilha] falha a rasterizar o logo:', e)
      return null
    }
  }

  async function gerarImagem(): Promise<Blob | null> {
    const d = opts.dados()
    if (!d) return null
    const logoDataUrl = await rasterizarLogo()
    return gerarCartaoResultado({ ...d, logoDataUrl })
  }

  function descarregarBlob(blob: Blob, nomeFicheiro: string) {
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href; a.download = nomeFicheiro
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  async function partilhar() {
    if (!import.meta.client) return
    aGerar.value = true
    let blob: Blob | null = null
    try { blob = await gerarImagem() } catch { blob = null }
    aGerar.value = false

    const ficheiro = blob ? new File([blob], 'office-showdown.png', { type: 'image/png' }) : null
    // Ao partilhar ficheiro, alguns apps ignoram o campo `url` — por isso meto o link no texto.
    const textoComLink = `${opts.texto()} ${opts.url()}`

    // 1) Partilha nativa COM imagem (Web Share API nível 2)
    if (ficheiro && navigator.canShare?.({ files: [ficheiro] })) {
      try {
        await navigator.share({ title: 'Office Showdown', text: textoComLink, files: [ficheiro] })
        return
      } catch { return /* cancelado pelo utilizador */ }
    }

    // 2) Partilha nativa só com texto/link (sem suporte a ficheiros)
    if (navigator.share) {
      try { await navigator.share({ title: 'Office Showdown', text: opts.texto(), url: opts.url() }); return }
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

  async function descarregarImagem() {
    aDescarregar.value = true
    try {
      const blob = await gerarImagem()
      if (blob) descarregarBlob(blob, 'office-showdown.png')
    } finally { aDescarregar.value = false }
  }

  return { aGerar, aDescarregar, copiado, partilhar, descarregarImagem }
}
