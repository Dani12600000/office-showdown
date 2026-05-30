-- ==========================================================
-- MIGRAÇÃO 004 — Batalha Naval (Battleship) na Ronda 4
-- Correr no Supabase SQL Editor sobre o schema já existente.
-- (Idempotente — pode correr-se mais que uma vez.)
-- ==========================================================
--
-- Grelha 5×5 por jogador (25 casas, índice = linha*5 + coluna).
-- Frota de tamanhos VARIADOS: Couraçado(3) · Submarino(2) · Lancha(1) = 6 casas.
-- Há FASE DE POSICIONAMENTO: cada jogador escolhe onde coloca a sua frota.
-- O servidor valida a legalidade da colocação (anti-batota).
--
-- ⚠️ Informação escondida:
--   Os navios vivem em `partida_navios` com RLS SEM políticas → nenhum
--   cliente lê a tabela diretamente. Só funções security definer acedem.
--   Cada jogador obtém os SEUS navios via `obter_navios`; o admin obtém
--   os dos bots que controla. O adversário nunca os consegue ver.
--
-- `partidas.estado` (público):
--   {
--     "fase": "POSICIONAR" | "COMBATE",
--     "vez": 1|2,
--     "pronto_1": bool, "pronto_2": bool,       -- já posicionou a frota?
--     "grelha_1": [25] (tiros RECEBIDOS pelo j1) null|'agua'|'acerto',
--     "grelha_2": [25] (tiros RECEBIDOS pelo j2),
--     "restantes_1": int, "restantes_2": int,   -- casas de navio por afundar
--     "ultimo": { por, pos, resultado:'agua'|'acerto'|'afundou', navio:int[]|null },
--     "navios_1": int[][]|null, "navios_2": int[][]|null  -- revelados só no fim
--   }

-- ----------------------------------------------------------
-- Tabela escondida dos navios
-- ----------------------------------------------------------
create table if not exists public.partida_navios (
  partida_id uuid not null references public.partidas(id) on delete cascade,
  jogador_id uuid not null references public.profiles(id) on delete cascade,
  navios     jsonb not null,
  primary key (partida_id, jogador_id)
);
alter table public.partida_navios enable row level security;
-- Sem políticas: clientes não acedem. Só as funções security definer abaixo.

-- Limpa funções da versão antiga (colocação automática)
drop function if exists public.garantir_navios(uuid);
drop function if exists public.gerar_frota_naval();


-- ----------------------------------------------------------
-- Obter os navios de um jogador (só os próprios; admin vê os de bots)
-- ----------------------------------------------------------
create or replace function public.obter_navios(p_partida_id uuid, p_jogador_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean; v_bot boolean; v_navios jsonb;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  if p_jogador_id <> v_uid then
    select admin  into v_admin from public.profiles where id = v_uid;
    select is_bot into v_bot   from public.profiles where id = p_jogador_id;
    if not (coalesce(v_admin,false) and coalesce(v_bot,false)) then
      raise exception 'Sem permissão para ver estes navios';
    end if;
  end if;
  select navios into v_navios from public.partida_navios
    where partida_id = p_partida_id and jogador_id = p_jogador_id;
  return v_navios;
end; $$;
grant execute on function public.obter_navios(uuid, uuid) to authenticated;


-- ----------------------------------------------------------
-- Posicionar a frota (validação server-side)
-- p_navios: [[c,c,c],[c,c],[c]]  (tamanhos exatos 3, 2, 1)
-- Cada navio: casas em linha reta e seguidas; sem sobreposições.
-- Marca o jogador como pronto; quando ambos prontos → fase COMBATE.
-- ----------------------------------------------------------
create or replace function public.posicionar_navios(
  p_partida_id uuid,
  p_navios jsonb,
  p_jogador_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.partidas;
  v_uid uuid := auth.uid();
  v_acting uuid;
  v_slot int;
  v_sou_admin boolean; v_alvo_bot boolean;
  v_e jsonb;
  v_navio jsonb;
  v_ship int[];
  v_len int;
  v_lens int[] := array[]::int[];
  v_cells int[] := array[]::int[];
  v_allrow boolean; v_allcol boolean; v_isline boolean;
  i int;
begin
  select * into v from public.partidas where id = p_partida_id for update;
  if v.id is null then raise exception 'Partida não existe'; end if;
  if v.status = 'TERMINADO' then raise exception 'A partida já terminou'; end if;
  if v.jogador2_id is null then raise exception 'Partida sem adversário'; end if;

  v_e := v.estado;
  if coalesce(v_e->>'fase','POSICIONAR') = 'COMBATE' then
    raise exception 'O combate já começou — já não podes mudar a frota';
  end if;

  -- Quem posiciona? (próprio, ou bot personificado por admin)
  if p_jogador_id is null or p_jogador_id = v_uid then
    v_acting := v_uid;
  else
    select admin  into v_sou_admin from public.profiles where id = v_uid;
    select is_bot into v_alvo_bot  from public.profiles where id = p_jogador_id;
    if not coalesce(v_sou_admin,false) then raise exception 'Apenas admins podem posicionar por outros'; end if;
    if not coalesce(v_alvo_bot,false)  then raise exception 'Só podes personificar bots'; end if;
    v_acting := p_jogador_id;
  end if;

  if v_acting = v.jogador1_id then v_slot := 1;
  elsif v_acting = v.jogador2_id then v_slot := 2;
  else raise exception 'Esse jogador não pertence a esta partida'; end if;

  -- Valida cada navio
  for v_navio in select value from jsonb_array_elements(p_navios) loop
    v_ship := array(select (e.value)::int from jsonb_array_elements_text(v_navio) e order by (e.value)::int);
    v_len := coalesce(array_length(v_ship,1), 0);
    if v_len = 0 then raise exception 'Navio vazio'; end if;

    foreach i in array v_ship loop
      if i < 0 or i > 24 then raise exception 'Casa fora da grelha'; end if;
    end loop;

    -- Linha reta e seguida?
    v_allrow := true; v_allcol := true;
    for i in 1..v_len loop
      if (v_ship[i] / 5) <> (v_ship[1] / 5) then v_allrow := false; end if;
      if (v_ship[i] % 5) <> (v_ship[1] % 5) then v_allcol := false; end if;
    end loop;
    v_isline := false;
    if v_len = 1 then v_isline := true;
    elsif v_allrow then
      v_isline := true;
      for i in 2..v_len loop if v_ship[i] <> v_ship[i-1] + 1 then v_isline := false; end if; end loop;
    elsif v_allcol then
      v_isline := true;
      for i in 2..v_len loop if v_ship[i] <> v_ship[i-1] + 5 then v_isline := false; end if; end loop;
    end if;
    if not v_isline then raise exception 'Cada navio tem de ocupar casas em linha reta e seguidas'; end if;

    v_lens := v_lens || v_len;
    v_cells := v_cells || v_ship;
  end loop;

  -- A frota tem de ser exatamente {3,2,1}
  if (array(select l from unnest(v_lens) l order by l)) <> array[1,2,3] then
    raise exception 'A frota tem de ter navios de tamanho 3, 2 e 1';
  end if;
  -- Sem sobreposições
  if array_length(v_cells,1) <> (select count(distinct cc) from unnest(v_cells) cc) then
    raise exception 'Os navios não se podem sobrepor';
  end if;

  -- Guarda a frota + marca pronto
  insert into public.partida_navios (partida_id, jogador_id, navios)
    values (p_partida_id, v_acting, p_navios)
    on conflict (partida_id, jogador_id) do update set navios = excluded.navios;

  v_e := jsonb_set(v_e, array['pronto_'||v_slot], 'true'::jsonb);

  -- Ambos prontos → começa o combate
  if coalesce((v_e->>'pronto_1')::boolean,false) and coalesce((v_e->>'pronto_2')::boolean,false) then
    v_e := jsonb_set(v_e, '{fase}', '"COMBATE"');
    v_e := jsonb_set(v_e, '{restantes_1}', to_jsonb(6));
    v_e := jsonb_set(v_e, '{restantes_2}', to_jsonb(6));
    v_e := jsonb_set(v_e, '{vez}', to_jsonb(1));
  end if;

  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;
grant execute on function public.posicionar_navios(uuid, jsonb, uuid) to authenticated;


-- ----------------------------------------------------------
-- Disparar (resolução atómica) — só na fase de COMBATE
-- ----------------------------------------------------------
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

  v_e := jsonb_set(v_e, '{vez}', to_jsonb(v_opp));
  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;
grant execute on function public.jogar_naval(uuid, int, uuid) to authenticated;
