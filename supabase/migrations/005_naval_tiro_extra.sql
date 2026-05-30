-- ==========================================================
-- MIGRAÇÃO 005 — Batalha Naval: acerto dá tiro extra
-- Regra clássica: se acertas (ou afundas), jogas outra vez.
-- Só passas a vez quando falhas (água).
-- (Substitui apenas jogar_naval — idempotente.)
-- ==========================================================

create or replace function public.jogar_naval(
  p_partida_id uuid,
  p_pos int,
  p_jogador_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.partidas;
  v_uid uuid := auth.uid();
  v_acting uuid;
  v_slot int; v_opp int; v_opp_id uuid;
  v_sou_admin boolean; v_alvo_bot boolean;
  v_e jsonb; v_vez int;
  v_vazio jsonb;
  v_grelha jsonb;
  v_navios jsonb;
  v_restantes int;
  v_navio jsonb; v_navio_atingido jsonb := null;
  v_hit boolean := false;
  v_resultado text;
  v_todas boolean;
  v_celltxt text;
begin
  if p_pos < 0 or p_pos > 24 then raise exception 'Posição inválida'; end if;

  select * into v from public.partidas where id = p_partida_id for update;
  if v.status = 'TERMINADO' then return; end if;
  if v.revelar_ate is not null and now() < v.revelar_ate then return; end if;
  if v.jogador2_id is null then return; end if;

  v_e := v.estado;
  if coalesce(v_e->>'fase','COMBATE') <> 'COMBATE' then
    raise exception 'A frota ainda está a ser posicionada';
  end if;

  if p_jogador_id is null or p_jogador_id = v_uid then
    v_acting := v_uid;
  else
    select admin  into v_sou_admin from public.profiles where id = v_uid;
    select is_bot into v_alvo_bot  from public.profiles where id = p_jogador_id;
    if not coalesce(v_sou_admin,false) then raise exception 'Apenas admins podem jogar por outros'; end if;
    if not coalesce(v_alvo_bot,false)  then raise exception 'Só podes personificar bots'; end if;
    v_acting := p_jogador_id;
  end if;

  if v_acting = v.jogador1_id then v_slot := 1; v_opp := 2; v_opp_id := v.jogador2_id;
  elsif v_acting = v.jogador2_id then v_slot := 2; v_opp := 1; v_opp_id := v.jogador1_id;
  else raise exception 'Esse jogador não pertence a esta partida'; end if;

  v_vez := coalesce((v_e->>'vez')::int, 1);
  if v_slot <> v_vez then raise exception 'Não é a tua vez'; end if;

  v_vazio := (select jsonb_agg(null::int) from generate_series(1,25));
  v_grelha := coalesce(v_e->('grelha_'||v_opp), v_vazio);
  select coalesce(navios,'[]'::jsonb) into v_navios from public.partida_navios
    where partida_id = p_partida_id and jogador_id = v_opp_id;

  if v_grelha->>p_pos is not null then return; end if;

  for v_navio in select value from jsonb_array_elements(v_navios) loop
    if exists (select 1 from jsonb_array_elements_text(v_navio) t where (t.value)::int = p_pos) then
      v_hit := true; v_navio_atingido := v_navio; exit;
    end if;
  end loop;

  v_restantes := coalesce((v_e->>('restantes_'||v_opp))::int, 0);

  if v_hit then
    v_grelha := jsonb_set(v_grelha, array[p_pos::text], '"acerto"'::jsonb);
    v_restantes := v_restantes - 1;
    v_todas := true;
    for v_celltxt in select value from jsonb_array_elements_text(v_navio_atingido) loop
      if v_grelha->>((v_celltxt)::int) is distinct from 'acerto' then v_todas := false; exit; end if;
    end loop;
    if v_todas then v_resultado := 'afundou';
    else v_resultado := 'acerto'; v_navio_atingido := null; end if;
  else
    v_grelha := jsonb_set(v_grelha, array[p_pos::text], '"agua"'::jsonb);
    v_resultado := 'agua';
  end if;

  v_e := jsonb_set(v_e, array['grelha_'||v_opp], v_grelha);
  v_e := jsonb_set(v_e, array['restantes_'||v_opp], to_jsonb(v_restantes));
  v_e := jsonb_set(v_e, '{ultimo}', jsonb_build_object(
    'por', v_slot, 'pos', p_pos, 'resultado', v_resultado,
    'navio', coalesce(v_navio_atingido, 'null'::jsonb)
  ));

  if v_restantes <= 0 then
    v_e := jsonb_set(v_e, '{navios_1}',
      coalesce((select navios from public.partida_navios where partida_id=p_partida_id and jogador_id=v.jogador1_id), '[]'::jsonb));
    v_e := jsonb_set(v_e, '{navios_2}',
      coalesce((select navios from public.partida_navios where partida_id=p_partida_id and jogador_id=v.jogador2_id), '[]'::jsonb));
    update public.partidas
      set estado = v_e,
          vencedor_id = case when v_slot = 1 then v.jogador1_id else v.jogador2_id end,
          status = 'TERMINADO',
          revelar_ate = now() + interval '5 seconds'
      where id = p_partida_id;
    return;
  end if;

  -- Acerto/afundou → joga outra vez; água → passa a vez
  if v_resultado = 'agua' then
    v_e := jsonb_set(v_e, '{vez}', to_jsonb(v_opp));
  end if;
  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;
grant execute on function public.jogar_naval(uuid, int, uuid) to authenticated;
