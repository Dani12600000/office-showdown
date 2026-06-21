-- ==========================================================
-- MIGRAÇÃO 006 — Revelação do PPT mais longa (rufar de tambor)
-- Correr no Supabase SQL Editor sobre o schema já existente.
-- (Idempotente — pode correr-se mais que uma vez.)
-- ==========================================================
--
-- O som de revelação (revelacao.mp3) é um rufar de tambor de ~4,15s. Antes a
-- janela de revelação era 5s, por isso a jogada aparecia ANTES de o tambor
-- acabar. Agora a revelação de uma ronda INTERMÉDIA passa para 6,5s — o
-- projetor segura o suspense ~4,3s (até o tambor acabar) e ainda sobram ~2,2s
-- para mostrar o resultado.
--
-- O ponto final (vitória) continua a 5s — aí há confetti imediato, não tambor.
--
-- Só muda a função `jogar_ppt` (CREATE OR REPLACE). Sem alterações de tabelas.
-- ==========================================================

create or replace function public.jogar_ppt(
  p_partida_id uuid,
  p_escolha text,
  p_jogador_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.partidas;
  v_uid uuid := auth.uid();
  v_acting uuid;
  v_sou_admin boolean;
  v_alvo_bot boolean;
  v_e jsonb;
  v_e1 text; v_e2 text;
  v_p1 int; v_p2 int;
  v_venc uuid;
begin
  if p_escolha not in ('pedra','papel','tesoura') then
    raise exception 'Escolha inválida';
  end if;

  select * into v from public.partidas where id = p_partida_id for update;
  if v.status = 'TERMINADO' then return; end if;
  -- bloqueia jogadas durante a revelação
  if v.revelar_ate is not null and now() < v.revelar_ate then return; end if;

  -- Quem joga? (eu próprio, ou um bot que personifico sendo admin)
  if p_jogador_id is null or p_jogador_id = v_uid then
    v_acting := v_uid;
  else
    select admin  into v_sou_admin from public.profiles where id = v_uid;
    select is_bot into v_alvo_bot  from public.profiles where id = p_jogador_id;
    if not coalesce(v_sou_admin,false) then raise exception 'Apenas admins podem jogar por outros'; end if;
    if not coalesce(v_alvo_bot,false)  then raise exception 'Só podes personificar bots'; end if;
    v_acting := p_jogador_id;
  end if;

  if v_acting not in (v.jogador1_id, v.jogador2_id) then
    raise exception 'Esse jogador não pertence a esta partida';
  end if;

  v_e  := v.estado;
  v_e1 := v_e->>'escolha_j1';
  v_e2 := v_e->>'escolha_j2';

  if v_acting = v.jogador1_id then
    if v_e1 is null then v_e := jsonb_set(v_e,'{escolha_j1}',to_jsonb(p_escolha)); v_e1 := p_escolha; end if;
  else
    if v_e2 is null then v_e := jsonb_set(v_e,'{escolha_j2}',to_jsonb(p_escolha)); v_e2 := p_escolha; end if;
  end if;

  v_p1 := coalesce((v_e->>'pontos_j1')::int,0);
  v_p2 := coalesce((v_e->>'pontos_j2')::int,0);

  -- ambos escolheram → resolve a sub-ronda
  if v_e1 is not null and v_e2 is not null then
    if v_e1 = v_e2 then
      v_venc := null;
    elsif (v_e1='pedra' and v_e2='tesoura')
       or (v_e1='tesoura' and v_e2='papel')
       or (v_e1='papel' and v_e2='pedra') then
      v_venc := v.jogador1_id; v_p1 := v_p1 + 1;
    else
      v_venc := v.jogador2_id; v_p2 := v_p2 + 1;
    end if;

    v_e := jsonb_set(v_e, '{pontos_j1}', to_jsonb(v_p1));
    v_e := jsonb_set(v_e, '{pontos_j2}', to_jsonb(v_p2));
    v_e := jsonb_set(v_e, '{escolha_j1}', 'null'::jsonb);
    v_e := jsonb_set(v_e, '{escolha_j2}', 'null'::jsonb);
    v_e := jsonb_set(v_e, '{sub_ronda}', to_jsonb(coalesce((v_e->>'sub_ronda')::int,1) + 1));
    v_e := jsonb_set(v_e, '{historico}',
      coalesce(v_e->'historico','[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object('e1', v_e1, 'e2', v_e2, 'vencedor', v_venc)));

    -- Revelação: ponto final 5s; ronda intermédia 6,5s (dá tempo ao rufar de
    -- tambor do projetor acabar antes de mostrar a jogada).
    if v_p1 >= 2 then
      update public.partidas set estado=v_e, vencedor_id=jogador1_id, status='TERMINADO',
        revelar_ate = now() + interval '5 seconds' where id=p_partida_id; return;
    elsif v_p2 >= 2 then
      update public.partidas set estado=v_e, vencedor_id=jogador2_id, status='TERMINADO',
        revelar_ate = now() + interval '5 seconds' where id=p_partida_id; return;
    end if;
    update public.partidas set estado=v_e, revelar_ate = now() + interval '6500 milliseconds' where id=p_partida_id; return;
  end if;

  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;

grant execute on function public.jogar_ppt(uuid, text, uuid) to authenticated;
