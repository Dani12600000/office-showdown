// Gera (no cliente) um cartão de resultado em PNG com a Canvas API, para partilhar
// como FICHEIRO via Web Share API. Mostra: logo Office Showdown em cima, o campeão
// e o maior apostador. Não depende do nuxt-og-image — é desenhado à mão aqui.

export type DadosCartao = {
  torneio: string
  campeaoNome: string
  campeaoAvatar: string | null
  apostadorNome: string | null
  apostadorAvatar: string | null
  apostadorGanho: number | null
  // PNG (data URL) do componente LogoShowdown já rasterizado pela página.
  // Se faltar, desenha-se um logo de recurso em texto.
  logoDataUrl?: string | null
}

const W = 1080  // largura
const H = 1350  // altura (retrato 4:5 — bom para WhatsApp/stories)

// Carrega uma imagem com CORS (necessário para não "contaminar" o canvas).
// Devolve null se falhar/expirar — nesse caso desenha-se a inicial.
function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let resolvido = false
    const terminar = (v: HTMLImageElement | null) => { if (!resolvido) { resolvido = true; resolve(v) } }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => terminar(img)
    img.onerror = () => terminar(null)
    img.src = src
    setTimeout(() => terminar(null), 6000)
  })
}

// Ajusta o tamanho da fonte para o texto caber em maxLargura.
function ajustarFonte(ctx: CanvasRenderingContext2D, texto: string, peso: number, tamMax: number, maxLargura: number) {
  let tam = tamMax
  do {
    ctx.font = `${peso} ${tam}px Inter, system-ui, sans-serif`
    if (ctx.measureText(texto).width <= maxLargura) break
    tam -= 4
  } while (tam > 20)
  return tam
}

// Desenha um avatar redondo com anel néon + brilho; usa a inicial se não houver imagem.
function desenharAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number, cy: number, r: number,
  corAnel: string, corBrilho: string, fundo: string, inicial: string,
) {
  // Brilho
  ctx.save()
  ctx.shadowColor = corBrilho
  ctx.shadowBlur = 60
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = fundo; ctx.fill()
  ctx.restore()

  // Imagem (recortada em círculo) ou inicial
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = fundo
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = corAnel
    ctx.font = `900 ${Math.round(r * 1.1)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(inicial, cx, cy + 4)
  }
  ctx.restore()

  // Anel
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.lineWidth = 10; ctx.strokeStyle = corAnel; ctx.stroke()
}

// Texto centrado com espaçamento entre letras (letterSpacing nem sempre existe).
function textoCentrado(ctx: CanvasRenderingContext2D, texto: string, cx: number, cy: number, espac = 0) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  try { (ctx as any).letterSpacing = `${espac}px` } catch { /* ignore */ }
  ctx.fillText(texto, cx, cy)
  try { (ctx as any).letterSpacing = '0px' } catch { /* ignore */ }
}

export async function gerarCartaoResultado(d: DadosCartao): Promise<Blob | null> {
  if (!import.meta.client) return null

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Garante a fonte Inter pronta antes de medir/desenhar
  try { await (document as any).fonts?.ready } catch { /* ignore */ }

  // Carrega avatares (+ logo rasterizado) em paralelo
  const [imgCamp, imgApost, imgLogo] = await Promise.all([
    d.campeaoAvatar ? carregarImagem(d.campeaoAvatar) : Promise.resolve(null),
    d.apostadorAvatar ? carregarImagem(d.apostadorAvatar) : Promise.resolve(null),
    d.logoDataUrl ? carregarImagem(d.logoDataUrl) : Promise.resolve(null),
  ])

  const CIANO = '#00E5FF', VERMELHO = '#FF1744', OURO = '#FFD600'
  const cx = W / 2
  const temApostador = !!d.apostadorNome

  // ---- Fundo ----
  ctx.fillStyle = '#0D0D1A'
  ctx.fillRect(0, 0, W, H)
  const g1 = ctx.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, W)
  g1.addColorStop(0, 'rgba(0,229,255,0.20)'); g1.addColorStop(1, 'rgba(0,229,255,0)')
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)
  const g2 = ctx.createRadialGradient(W * 0.9, H, 0, W * 0.9, H, W)
  g2.addColorStop(0, 'rgba(255,23,68,0.22)'); g2.addColorStop(1, 'rgba(255,23,68,0)')
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)
  // Moldura subtil
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2
  ctx.strokeRect(24, 24, W - 48, H - 48)

  // ---- Logo (topo) ----
  if (imgLogo) {
    // Logo REAL (componente LogoShowdown rasterizado), ajustado a uma caixa no topo.
    const boxW = 640, boxH = 230, boxTop = 70
    const ar = imgLogo.width / imgLogo.height
    let dw = boxW, dh = dw / ar
    if (dh > boxH) { dh = boxH; dw = dh * ar }
    ctx.drawImage(imgLogo, cx - dw / 2, boxTop + (boxH - dh) / 2, dw, dh)
  } else {
    // Recurso: logo em texto (caso a rasterização falhe)
    ctx.font = '900 92px Inter, system-ui, sans-serif'
    ctx.fillStyle = CIANO; textoCentrado(ctx, 'OFFICE', cx, 150, 2)
    ctx.fillStyle = VERMELHO; textoCentrado(ctx, 'SHOWDOWN', cx, 250, 2)
    const lg = ctx.createLinearGradient(cx - 200, 0, cx + 200, 0)
    lg.addColorStop(0, 'rgba(0,229,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,23,68,0)')
    ctx.fillStyle = lg; ctx.fillRect(cx - 200, 312, 400, 3)
  }

  // ---- Campeão (herói) ----
  ctx.fillStyle = OURO
  ctx.font = '800 36px Inter, system-ui, sans-serif'
  textoCentrado(ctx, '🏆  CAMPEÃO', cx, 400, 10)

  desenharAvatar(ctx, imgCamp, cx, 600, 178, CIANO, 'rgba(0,229,255,0.6)', '#10243a', (d.campeaoNome || '?').charAt(0).toUpperCase())

  const tamNomeC = ajustarFonte(ctx, d.campeaoNome || '—', 900, 88, W - 140)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 ${tamNomeC}px Inter, system-ui, sans-serif`
  textoCentrado(ctx, d.campeaoNome || '—', cx, 880)

  if (d.torneio) {
    ctx.fillStyle = 'rgba(255,255,255,0.68)'
    const tamT = ajustarFonte(ctx, d.torneio, 600, 38, W - 160)
    ctx.font = `600 ${tamT}px Inter, system-ui, sans-serif`
    textoCentrado(ctx, d.torneio, cx, 948)
  }

  // ---- Maior apostador (cartão horizontal, em baixo) ----
  if (temApostador) {
    const cardX = 110, cardY = 1075, cardW = W - 220, cardH = 200
    ctx.save()
    ctx.beginPath()
    ;(ctx as any).roundRect(cardX, cardY, cardW, cardH, 28)
    ctx.fillStyle = 'rgba(255,23,68,0.08)'; ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,23,68,0.45)'; ctx.stroke()
    ctx.restore()

    const avCy = cardY + cardH / 2 // 1175
    const avCx = cardX + 110
    desenharAvatar(ctx, imgApost, avCx, avCy, 76, VERMELHO, 'rgba(255,23,68,0.55)', '#3a1018', (d.apostadorNome || '?').charAt(0).toUpperCase())

    const textoX = avCx + 130
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillStyle = VERMELHO
    ctx.font = '800 26px Inter, system-ui, sans-serif'
    try { (ctx as any).letterSpacing = '6px' } catch { /* ignore */ }
    ctx.fillText('MAIOR APOSTADOR', textoX, avCy - 52)
    try { (ctx as any).letterSpacing = '0px' } catch { /* ignore */ }

    const largMax = cardX + cardW - textoX - 30
    const tamNomeA = ajustarFonte(ctx, d.apostadorNome || '', 900, 52, largMax)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `900 ${tamNomeA}px Inter, system-ui, sans-serif`
    ctx.fillText(d.apostadorNome || '', textoX, avCy)

    if (d.apostadorGanho != null) {
      ctx.fillStyle = OURO
      ctx.font = '800 32px Inter, system-ui, sans-serif'
      ctx.fillText(`+${d.apostadorGanho} 🪙 de lucro`, textoX, avCy + 52)
    }
  }

  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
}
