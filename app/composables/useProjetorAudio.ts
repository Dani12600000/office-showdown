// Motor de som do PROJETOR (só aqui há áudio — telemóveis/admin ficam mudos).
//
// - Loops de fundo por "cena" (lobby, confrontos, apostas, jogo, standby, campeão)
//   com crossfade suave ao mudar de estado.
// - Stingers (one-shots) em momentos-chave: começar, intro VS, vitória, revelação.
// - Autoplay: os browsers bloqueiam áudio até haver 1 gesto do utilizador, por isso
//   o som só arranca depois de `ativar()` (ligado a um botão "Ativar som").
//
// Ficheiros em /public/sons/<nome>.mp3 — ver useProjetorAudio() abaixo.

export type LoopNome = 'lobby' | 'confrontos' | 'apostas' | 'jogo' | 'standby' | 'campeao' | 'vitoria_longa'
export type StingerNome = 'comecar' | 'intro-vs' | 'vitoria' | 'revelacao'

// Volume de cada loop (fundo discreto — não abafar a sala/apresentador)
const VOL_LOOP: Record<LoopNome, number> = {
  lobby:         0.35,
  confrontos:    0.45,
  apostas:       0.40,
  jogo:          0.30,
  standby:       0.28,
  campeao:       0.50,
  vitoria_longa: 0.50,
}
const VOL_STINGER = 0.7
const FADE_MS = 650

export function useProjetorAudio() {
  const ativo = ref(false)   // som desbloqueado (após gesto do utilizador)
  const mudo  = ref(false)   // silenciado manualmente

  // Cache de elementos <audio> (criados só no cliente, à medida que são precisos)
  const cache = new Map<string, HTMLAudioElement>()

  let loopAtual: LoopNome | null = null
  let elAtual: HTMLAudioElement | null = null
  let pedido: LoopNome | null = null   // última cena pedida (mesmo antes de ativar)

  const obter = (nome: string, loop: boolean): HTMLAudioElement => {
    let a = cache.get(nome)
    if (!a) {
      a = new Audio(`/sons/${nome}.mp3`)
      a.loop = loop
      a.preload = 'auto'
      a.muted = mudo.value
      cache.set(nome, a)
    }
    return a
  }

  const clamp = (v: number) => Math.max(0, Math.min(1, v))

  // Ramp de volume; cancela um fade anterior no mesmo elemento.
  const fade = (el: HTMLAudioElement, para: number, aoFim?: () => void) => {
    const ant = (el as any)._fade as ReturnType<typeof setInterval> | undefined
    if (ant) clearInterval(ant)
    const de = el.volume
    const passos = 20
    let i = 0
    const id = setInterval(() => {
      i++
      el.volume = clamp(de + (para - de) * (i / passos))
      if (i >= passos) {
        clearInterval(id)
        ;(el as any)._fade = undefined
        aoFim?.()
      }
    }, FADE_MS / passos)
    ;(el as any)._fade = id
  }

  // Toca/troca o loop de fundo. `null` = silêncio. Faz crossfade.
  const tocarLoop = (nome: LoopNome | null) => {
    pedido = nome
    if (!ativo.value) return
    if (nome === loopAtual) return
    loopAtual = nome

    // Fade-out do loop anterior
    const antigo = elAtual
    if (antigo) fade(antigo, 0, () => antigo.pause())

    if (!nome) { elAtual = null; return }

    const el = obter(nome, true)
    el.muted = mudo.value
    el.volume = 0
    el.play().catch(() => {})
    fade(el, VOL_LOOP[nome])
    elAtual = el
  }

  // Sequência do ecrã de campeão: toca `vitoria.mp3` UMA vez (remate) e, quando
  // acabar, arranca `vitoria_longa.mp3` em loop (música de fundo da vitória).
  // É idempotente — chamar de novo enquanto já está nesta cena não faz nada.
  const tocarVitoria = () => {
    pedido = 'vitoria_longa'
    if (!ativo.value) return
    if (loopAtual === 'vitoria_longa') return
    loopAtual = 'vitoria_longa'

    // Corta o loop de fundo anterior (ex.: 'jogo'/'standby')
    const antigo = elAtual
    if (antigo) fade(antigo, 0, () => antigo.pause())
    elAtual = null

    const arrancarLoop = () => {
      if (loopAtual !== 'vitoria_longa') return   // mudou de cena entretanto
      const el = obter('vitoria_longa', true)
      el.muted = mudo.value
      el.volume = 0
      el.play().catch(() => {})
      fade(el, VOL_LOOP['vitoria_longa'])
      elAtual = el
    }

    const intro = obter('vitoria', false)
    intro.muted = mudo.value
    intro.volume = VOL_STINGER
    intro.onended = arrancarLoop
    try { intro.currentTime = 0 } catch {}
    // Se o one-shot não tocar (bloqueio/erro), arranca o loop à mesma.
    intro.play().catch(() => { arrancarLoop() })
  }

  // Toca um stinger (one-shot) por cima do loop atual.
  const tocarStinger = (nome: StingerNome) => {
    if (!ativo.value || mudo.value) return
    const el = obter(nome, false)
    el.muted = false
    el.volume = VOL_STINGER
    try { el.currentTime = 0 } catch {}
    el.play().catch(() => {})
  }

  // Desbloqueia o áudio (chamar a partir de um clique). Arranca a cena pendente.
  const ativar = () => {
    if (ativo.value) return
    ativo.value = true
    const inicial = pedido
    loopAtual = null
    elAtual = null
    // Se a cena pendente é a vitória, arranca com o remate + loop longo.
    if (inicial === 'vitoria_longa') tocarVitoria()
    else if (inicial) tocarLoop(inicial)
  }

  const alternarMudo = () => {
    mudo.value = !mudo.value
    cache.forEach(el => { el.muted = mudo.value })
  }

  onUnmounted(() => {
    cache.forEach(el => { try { el.pause() } catch {} })
    cache.clear()
  })

  return { ativo, mudo, ativar, alternarMudo, tocarLoop, tocarStinger, tocarVitoria }
}
