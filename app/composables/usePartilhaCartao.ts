import { gerarCartaoResultado, type DadosCartao } from './useCartaoResultado'

// Lógica partilhada de partilha/descarregamento do cartão de resultado (PNG),
// usada tanto no ecrã de campeão (index.vue) como na página pública (resultado.vue).
//
// - `dados`: getter dos dados do cartão. Devolve null se não houver campeão
//   (ex.: torneio ainda a decorrer) — nesse caso não se gera imagem.
// - `texto` / `url`: texto e link da partilha.
export function usePartilhaCartao(opts: {
  dados: () => DadosCartao | null
  texto: () => string
  url: () => string
}) {
  const aGerar = ref(false)
  const aDescarregar = ref(false)
  const copiado = ref(false)

  async function gerarImagem(): Promise<Blob | null> {
    const d = opts.dados()
    if (!d) return null
    return gerarCartaoResultado(d)
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
