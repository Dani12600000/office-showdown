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
}

// Path do ícone sword-cross (MDI) — desenhado diretamente no canvas, igual ao
// que o LogoShowdown usa, para o logo ser determinístico (sem html-to-image).
const SWORD_PATH = 'M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.29C1.27,19.68 1.27,20.31 1.66,20.7L2.37,21.41C2.76,21.8 3.39,21.8 3.78,21.41L7,18.23L9.44,20.7L10.85,19.29L8.73,17.17L10.94,15Z'

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

  // Carrega avatares em paralelo
  const [imgCamp, imgApost] = await Promise.all([
    d.campeaoAvatar ? carregarImagem(d.campeaoAvatar) : Promise.resolve(null),
    d.apostadorAvatar ? carregarImagem(d.apostadorAvatar) : Promise.resolve(null),
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

  // ---- Logo (topo) — desenhado no canvas (determinístico, igual ao LogoShowdown) ----
  // OFFICE (ciano, com brilho)
  ctx.save()
  ctx.shadowColor = 'rgba(0,229,255,0.55)'; ctx.shadowBlur = 26
  ctx.fillStyle = CIANO
  const tamOffice = ajustarFonte(ctx, 'OFFICE', 900, 96, W - 160)
  ctx.font = `900 ${tamOffice}px system-ui, 'Segoe UI', Roboto, sans-serif`
  textoCentrado(ctx, 'OFFICE', cx, 150, 3)
  ctx.restore()
  // SHOWDOWN (vermelho, com brilho)
  ctx.save()
  ctx.shadowColor = 'rgba(255,23,68,0.55)'; ctx.shadowBlur = 26
  ctx.fillStyle = VERMELHO
  const tamShow = ajustarFonte(ctx, 'SHOWDOWN', 900, 96, W - 120)
  ctx.font = `900 ${tamShow}px system-ui, 'Segoe UI', Roboto, sans-serif`
  textoCentrado(ctx, 'SHOWDOWN', cx, 252, 3)
  ctx.restore()
  // Barra: traço-azul · sword-cross · traço-vermelho
  const barY = 322, barW = 92, barH = 4, gap = 18, sword = 30
  const totalBar = barW * 2 + gap * 2 + sword
  let bx = cx - totalBar / 2
  const lgAzul = ctx.createLinearGradient(bx, 0, bx + barW, 0)
  lgAzul.addColorStop(0, 'rgba(0,229,255,0)'); lgAzul.addColorStop(1, '#00E5FF')
  ctx.fillStyle = lgAzul; ctx.fillRect(bx, barY - barH / 2, barW, barH)
  bx += barW + gap
  ctx.save()
  ctx.translate(bx, barY - sword / 2)
  ctx.scale(sword / 24, sword / 24)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fill(new Path2D(SWORD_PATH))
  ctx.restore()
  bx += sword + gap
  const lgVerm = ctx.createLinearGradient(bx, 0, bx + barW, 0)
  lgVerm.addColorStop(0, '#FF1744'); lgVerm.addColorStop(1, 'rgba(255,23,68,0)')
  ctx.fillStyle = lgVerm; ctx.fillRect(bx, barY - barH / 2, barW, barH)

  // ---- Campeão (herói) ----
  // Avatar mais pequeno e posições adaptadas a haver (ou não) maior apostador,
  // para sobrar espaço confortável ao cartão de baixo.
  const avR = temApostador ? 124 : 145
  const labelY = temApostador ? 432 : 400
  const campCy = 600
  const nomeY = campCy + avR + (temApostador ? 104 : 118)
  const torneioY = nomeY + 56

  ctx.fillStyle = OURO
  ctx.font = '800 34px Inter, system-ui, sans-serif'
  textoCentrado(ctx, '🏆  CAMPEÃO', cx, labelY, 10)

  desenharAvatar(ctx, imgCamp, cx, campCy, avR, CIANO, 'rgba(0,229,255,0.6)', '#10243a', (d.campeaoNome || '?').charAt(0).toUpperCase())

  const tamNomeC = ajustarFonte(ctx, d.campeaoNome || '—', 900, 82, W - 140)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `900 ${tamNomeC}px Inter, system-ui, sans-serif`
  textoCentrado(ctx, d.campeaoNome || '—', cx, nomeY)

  if (d.torneio) {
    ctx.fillStyle = 'rgba(255,255,255,0.68)'
    const tamT = ajustarFonte(ctx, d.torneio, 600, 36, W - 160)
    ctx.font = `600 ${tamT}px Inter, system-ui, sans-serif`
    textoCentrado(ctx, d.torneio, cx, torneioY)
  }

  // ---- Maior apostador (cartão horizontal, em baixo) ----
  if (temApostador) {
    const cardX = 110, cardY = 985, cardW = W - 220, cardH = 210
    ctx.save()
    ctx.beginPath()
    ;(ctx as any).roundRect(cardX, cardY, cardW, cardH, 28)
    ctx.fillStyle = 'rgba(255,23,68,0.08)'; ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,23,68,0.45)'; ctx.stroke()
    ctx.restore()

    const avCy = cardY + cardH / 2
    const avCx = cardX + 115
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
