export type StatusTorneio = 'LOBBY' | 'ARVORE' | 'JOGO' | 'FINAL'
export type StatusInscricao = 'QUER_JOGAR' | 'JOGADOR_CONFIRMADO' | 'PLATEIA'
export type NumeroRonda = 1 | 2 | 3 | 4

// Espelha a tabela `profiles` (sem password — essa fica no auth.users)
export interface Utilizador {
  id: string
  username: string
  name: string
  admin: boolean
  avatar_url: string | null
  is_bot?: boolean
  created_at?: string
}

export interface Torneio {
  id: string
  nome: string
  status: StatusTorneio
  ronda_atual: NumeroRonda
  ativo: boolean
  criado_por: string
  vencedor_id: string | null
  partida_destaque_id?: string | null
  max_jogadores?: number
  jogos_ronda?: Record<string, JogoTipo>
  created_at?: string
}

export interface TorneioParticipante {
  id: string
  torneio_id: string
  utilizador_id: string
  moedas: number
  status_inscricao: StatusInscricao
  // Joins opcionais
  utilizador?: Utilizador
  torneio?: Torneio
}

// ---- Catálogo de jogos ----

export type JogoTipo = 'PPT' | 'GALO' | 'QUATRO' | 'NAVAL'

export const JOGOS_CATALOGO: Record<JogoTipo, { nome: string; icon: string; disponivel: boolean }> = {
  PPT:    { nome: 'Pedra, Papel, Tesoura', icon: 'mdi-hand-back-left', disponivel: true },
  GALO:   { nome: 'Jogo do Galo',          icon: 'mdi-grid',          disponivel: true  },
  QUATRO: { nome: 'Quatro em Linha',       icon: 'mdi-dots-grid',     disponivel: true  },
  NAVAL:  { nome: 'Batalha Naval',         icon: 'mdi-ship-wheel',    disponivel: false },
}

// Mapeamento por defeito (clássico) de ronda → jogo
export const JOGOS_RONDA_DEFAULT: Record<string, JogoTipo> = {
  '1': 'PPT', '2': 'GALO', '3': 'QUATRO', '4': 'NAVAL',
}

// ---- Mapas auxiliares do motor de jogo ----

export const JOGO_POR_RONDA: Record<NumeroRonda, string> = {
  1: 'Pedra, Papel, Tesoura',
  2: 'Jogo do Galo',
  3: 'Quatro em Linha',
  4: 'Batalha Naval',
} as const

export const JOGADORES_POR_RONDA: Record<NumeroRonda, number> = {
  1: 16,
  2: 8,
  3: 4,
  4: 2,
} as const

export const NOME_RONDA: Record<NumeroRonda, string> = {
  1: 'Oitavos de Final',
  2: 'Quartos de Final',
  3: 'Meias-Finais',
  4: 'Grande Final',
} as const
