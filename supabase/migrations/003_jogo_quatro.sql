-- ==========================================================
-- MIGRAÇÃO 003 — Quatro em Linha (Connect Four) na Ronda 3
-- Correr no Supabase SQL Editor sobre o schema já existente.
-- ==========================================================
--
-- Estado:
--   {
--     "tabuleiro": [1|2|null]*42,  -- 6 linhas × 7 colunas, índice = linha*7 + coluna (linha 0 = topo)
--     "vez": 1,                    -- 1 = jogador1, 2 = jogador2
--     "comeca": 1,                 -- quem começou o tabuleiro atual (alterna em empates)
--     "empates": 0,                -- nº de tabuleiros cheios sem vencedor
--     "linha_vencedora": null      -- array de índices (>=4) quando alguém vence
--   }
--
-- A peça "cai" para a casa livre mais baixa da coluna escolhida.
-- Empate (tabuleiro cheio sem 4 em linha) → reinicia e troca quem começa
-- (revelação 3s); vitória termina a partida (revelação 5s).

create or replace function public.jogar_quatro(
  p_partida_id uuid,
  p_coluna int,
  p_jogador_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.partidas;
  v_uid uuid := auth.uid();
  v_acting uuid;
  v_slot int;
  v_e jsonb;
  v_tab jsonb;
  v_vazio jsonb;
  v_vez int;
  v_comeca int;
  v_empates int;
  v_sou_admin boolean;
  v_alvo_bot boolean;
  v_row int := -1;
  v_dirs int[][] := array[array[0,1], array[1,0], array[1,1], array[1,-1]];
  v_d int[];
  v_dr int; v_dc int;
  v_cells int[];
  v_ganhou boolean := false;
  v_linha int[];
  v_full boolean := true;
  r int; c int; i int;
begin
  if p_coluna < 0 or p_coluna > 6 then raise exception 'Coluna inválida'; end if;

  select * into v from public.partidas where id = p_partida_id for update;
  if v.status = 'TERMINADO' then return; end if;
  if v.revelar_ate is not null and now() < v.revelar_ate then return; end if;

  -- Quem joga? (próprio, ou bot personificado por admin)
  if p_jogador_id is null or p_jogador_id = v_uid then
    v_acting := v_uid;
  else
    select admin  into v_sou_admin from public.profiles where id = v_uid;
    select is_bot into v_alvo_bot  from public.profiles where id = p_jogador_id;
    if not coalesce(v_sou_admin,false) then raise exception 'Apenas admins podem jogar por outros'; end if;
    if not coalesce(v_alvo_bot,false)  then raise exception 'Só podes personificar bots'; end if;
    v_acting := p_jogador_id;
  end if;

  if v_acting = v.jogador1_id then v_slot := 1;
  elsif v_acting = v.jogador2_id then v_slot := 2;
  else raise exception 'Esse jogador não pertence a esta partida'; end if;

  v_vazio := (select jsonb_agg(null::int) from generate_series(1,42));

  v_e := v.estado;
  v_tab := coalesce(v_e->'tabuleiro', v_vazio);
  v_vez := coalesce((v_e->>'vez')::int, 1);
  v_comeca := coalesce((v_e->>'comeca')::int, 1);
  v_empates := coalesce((v_e->>'empates')::int, 0);

  if v_slot <> v_vez then raise exception 'Não é a tua vez'; end if;

  -- Gravidade: encontra a casa livre mais baixa da coluna (linha 5 = fundo)
  for r in reverse 5..0 loop
    if v_tab->>(r*7 + p_coluna) is null then v_row := r; exit; end if;
  end loop;
  if v_row = -1 then raise exception 'Coluna cheia'; end if;

  -- Coloca a peça
  v_tab := jsonb_set(v_tab, array[(v_row*7 + p_coluna)::text], to_jsonb(v_slot));

  -- Verifica 4 em linha nas 4 direções a partir da casa jogada
  foreach v_d slice 1 in array v_dirs loop
    v_dr := v_d[1]; v_dc := v_d[2];
    v_cells := array[v_row*7 + p_coluna];
    -- direção positiva
    r := v_row + v_dr; c := p_coluna + v_dc;
    while r >= 0 and r <= 5 and c >= 0 and c <= 6 and (v_tab->>(r*7+c))::int = v_slot loop
      v_cells := v_cells || (r*7+c); r := r + v_dr; c := c + v_dc;
    end loop;
    -- direção negativa
    r := v_row - v_dr; c := p_coluna - v_dc;
    while r >= 0 and r <= 5 and c >= 0 and c <= 6 and (v_tab->>(r*7+c))::int = v_slot loop
      v_cells := v_cells || (r*7+c); r := r - v_dr; c := c - v_dc;
    end loop;
    if array_length(v_cells, 1) >= 4 then
      v_ganhou := true; v_linha := v_cells; exit;
    end if;
  end loop;

  v_e := jsonb_set(v_e, '{tabuleiro}', v_tab);

  if v_ganhou then
    v_e := jsonb_set(v_e, '{linha_vencedora}', to_jsonb(v_linha));
    update public.partidas
      set estado = v_e,
          vencedor_id = case when v_slot = 1 then v.jogador1_id else v.jogador2_id end,
          status = 'TERMINADO',
          revelar_ate = now() + interval '5 seconds'
      where id = p_partida_id;
    return;
  end if;

  -- Empate (tabuleiro cheio) → reinicia, troca quem começa
  for i in 0..41 loop
    if v_tab->>i is null then v_full := false; exit; end if;
  end loop;

  if v_full then
    v_comeca := case when v_comeca = 1 then 2 else 1 end;
    v_empates := v_empates + 1;
    v_e := jsonb_set(v_e, '{tabuleiro}', v_vazio);
    v_e := jsonb_set(v_e, '{vez}', to_jsonb(v_comeca));
    v_e := jsonb_set(v_e, '{comeca}', to_jsonb(v_comeca));
    v_e := jsonb_set(v_e, '{empates}', to_jsonb(v_empates));
    update public.partidas set estado = v_e, revelar_ate = now() + interval '3 seconds' where id = p_partida_id;
    return;
  end if;

  -- Próxima vez
  v_e := jsonb_set(v_e, '{vez}', to_jsonb(case when v_slot = 1 then 2 else 1 end));
  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;

grant execute on function public.jogar_quatro(uuid, int, uuid) to authenticated;
