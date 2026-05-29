-- ==========================================================
-- MIGRAÇÃO 001 — Jogo do Galo (Tic-Tac-Toe) na Ronda 2
-- Correr no Supabase SQL Editor sobre o schema já existente.
-- ==========================================================

-- Estado inicial (referência para o cliente / documentação):
--   {
--     "tabuleiro": [null, null, null, null, null, null, null, null, null],  -- 9 casas (índice 0..8)
--     "vez": 1,                  -- 1 = jogador1, 2 = jogador2
--     "comeca": 1,               -- quem começou o tabuleiro atual (alterna em empates)
--     "empates": 0,              -- nº de tabuleiros completos sem vencedor
--     "linha_vencedora": null    -- array de 3 índices quando alguém vence
--   }

create or replace function public.jogar_galo(
  p_partida_id uuid,
  p_pos int,
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
  v_vez int;
  v_comeca int;
  v_empates int;
  v_sou_admin boolean;
  v_alvo_bot boolean;
  v_lines int[][] := array[
    array[0,1,2], array[3,4,5], array[6,7,8],   -- linhas
    array[0,3,6], array[1,4,7], array[2,5,8],   -- colunas
    array[0,4,8], array[2,4,6]                   -- diagonais
  ];
  v_l int[];
  v_ganhou boolean := false;
  v_linha int[];
  v_full boolean := true;
  i int;
begin
  if p_pos < 0 or p_pos > 8 then raise exception 'Posição inválida'; end if;

  select * into v from public.partidas where id = p_partida_id for update;
  if v.status = 'TERMINADO' then return; end if;
  -- Bloqueia jogadas durante a revelação (final ou empate)
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

  v_e := v.estado;
  v_tab := coalesce(v_e->'tabuleiro', '[null,null,null,null,null,null,null,null,null]'::jsonb);
  v_vez := coalesce((v_e->>'vez')::int, 1);
  v_comeca := coalesce((v_e->>'comeca')::int, 1);
  v_empates := coalesce((v_e->>'empates')::int, 0);

  if v_slot <> v_vez then raise exception 'Não é a tua vez'; end if;
  if v_tab->>p_pos is not null then raise exception 'Casa ocupada'; end if;

  -- Coloca a marca
  v_tab := jsonb_set(v_tab, array[p_pos::text], to_jsonb(v_slot));

  -- Verifica vitória
  foreach v_l slice 1 in array v_lines loop
    if (v_tab->>(v_l[1]))::int = v_slot
       and (v_tab->>(v_l[2]))::int = v_slot
       and (v_tab->>(v_l[3]))::int = v_slot then
      v_ganhou := true;
      v_linha := v_l;
      exit;
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

  -- Verifica empate (tabuleiro cheio)
  for i in 0..8 loop
    if v_tab->>i is null then v_full := false; exit; end if;
  end loop;

  if v_full then
    -- Empate → reinicia tabuleiro, troca quem começa
    v_comeca := case when v_comeca = 1 then 2 else 1 end;
    v_empates := v_empates + 1;
    v_e := jsonb_set(v_e, '{tabuleiro}', '[null,null,null,null,null,null,null,null,null]'::jsonb);
    v_e := jsonb_set(v_e, '{vez}', to_jsonb(v_comeca));
    v_e := jsonb_set(v_e, '{comeca}', to_jsonb(v_comeca));
    v_e := jsonb_set(v_e, '{empates}', to_jsonb(v_empates));
    update public.partidas
      set estado = v_e,
          revelar_ate = now() + interval '3 seconds'
      where id = p_partida_id;
    return;
  end if;

  -- Próxima vez
  v_e := jsonb_set(v_e, '{vez}', to_jsonb(case when v_slot = 1 then 2 else 1 end));
  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;

grant execute on function public.jogar_galo(uuid, int, uuid) to authenticated;
