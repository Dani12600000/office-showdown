export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          name: string
          admin: boolean
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          name: string
          admin?: boolean
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          name?: string
          admin?: boolean
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      torneios: {
        Row: {
          id: string
          nome: string
          status: 'LOBBY' | 'ARVORE' | 'JOGO' | 'FINAL'
          ronda_atual: 1 | 2 | 3 | 4
          ativo: boolean
          criado_por: string | null
          vencedor_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          status?: 'LOBBY' | 'ARVORE' | 'JOGO' | 'FINAL'
          ronda_atual?: number
          ativo?: boolean
          criado_por?: string | null
          vencedor_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          status?: 'LOBBY' | 'ARVORE' | 'JOGO' | 'FINAL'
          ronda_atual?: number
          ativo?: boolean
          criado_por?: string | null
          vencedor_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      torneio_participantes: {
        Row: {
          id: string
          torneio_id: string
          utilizador_id: string
          moedas: number
          status_inscricao: 'QUER_JOGAR' | 'JOGADOR_CONFIRMADO' | 'PLATEIA'
        }
        Insert: {
          id?: string
          torneio_id: string
          utilizador_id: string
          moedas?: number
          status_inscricao?: 'QUER_JOGAR' | 'JOGADOR_CONFIRMADO' | 'PLATEIA'
        }
        Update: {
          id?: string
          torneio_id?: string
          utilizador_id?: string
          moedas?: number
          status_inscricao?: 'QUER_JOGAR' | 'JOGADOR_CONFIRMADO' | 'PLATEIA'
        }
        Relationships: []
      }
      partidas: {
        Row: {
          id: string
          torneio_id: string
          ronda: number
          posicao: number
          jogador1_id: string | null
          jogador2_id: string | null
          vencedor_id: string | null
          estado: Json
          status: 'A_JOGAR' | 'TERMINADO'
          created_at: string
        }
        Insert: {
          id?: string
          torneio_id: string
          ronda: number
          posicao: number
          jogador1_id?: string | null
          jogador2_id?: string | null
          vencedor_id?: string | null
          estado?: Json
          status?: 'A_JOGAR' | 'TERMINADO'
          created_at?: string
        }
        Update: {
          id?: string
          torneio_id?: string
          ronda?: number
          posicao?: number
          jogador1_id?: string | null
          jogador2_id?: string | null
          vencedor_id?: string | null
          estado?: Json
          status?: 'A_JOGAR' | 'TERMINADO'
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_email_by_username: {
        Args: { p_username: string }
        Returns: string | null
      }
      jogar_ppt: {
        Args: {
          p_partida_id: string
          p_escolha: string
          p_jogador_id?: string | null
        }
        Returns: unknown
      }
      adicionar_bot: {
        Args: { p_torneio_id: string; p_nome: string }
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
