-- ==========================================================
-- OFFICE SHOWDOWN — Schema completo (estado atual)
-- Correr no Supabase SQL Editor (Dashboard → SQL Editor)
-- Recria toda a base de dados de raiz.
-- ==========================================================


-- ----------------------------------------------------------
-- 1. PROFILES
-- Dados públicos dos utilizadores.
-- NOTA: sem FK para auth.users — permite perfis de BOT (sem conta auth).
-- ----------------------------------------------------------
create table public.profiles (
  id         uuid primary key default gen_random_uuid(),
  username   text unique not null,
  name       text not null,
  admin      boolean not null default false,
  is_bot     boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Trigger: cria automaticamente um perfil quando um utilizador
-- é criado no Supabase Auth (Dashboard, signup, etc.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, admin)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'name',
    coalesce((new.raw_user_meta_data->>'admin')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------
-- 2. RPC — Resolver username → email (login com username)
-- ----------------------------------------------------------
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = lower(trim(p_username))
  limit 1;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;


-- ----------------------------------------------------------
-- 3. TORNEIOS
-- ----------------------------------------------------------
create table public.torneios (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  status              text not null default 'LOBBY'
                        check (status in ('LOBBY', 'ARVORE', 'JOGO', 'FINAL')),
  ronda_atual         int  not null default 1
                        check (ronda_atual between 1 and 4),
  ativo               boolean not null default true,
  criado_por          uuid references public.profiles(id) on delete set null,
  vencedor_id         uuid references public.profiles(id) on delete set null,
  max_jogadores       int  not null default 16,
  partida_destaque_id uuid,   -- FK adicionada após criar 'partidas' (ver secção 5)
  jogos_ronda         jsonb not null
                        default '{"1":"PPT","2":"GALO","3":"QUATRO","4":"NAVAL"}'::jsonb,
  created_at          timestamptz not null default now()
);


-- ----------------------------------------------------------
-- 4. TORNEIO_PARTICIPANTES
-- ----------------------------------------------------------
create table public.torneio_participantes (
  id               uuid primary key default gen_random_uuid(),
  torneio_id       uuid not null references public.torneios(id) on delete cascade,
  utilizador_id    uuid not null references public.profiles(id) on delete cascade,
  moedas           int  not null default 100,
  status_inscricao text not null default 'QUER_JOGAR'
                     check (status_inscricao in ('QUER_JOGAR', 'JOGADOR_CONFIRMADO', 'PLATEIA')),
  preferencia      text not null default 'JOGAR'
                     check (preferencia in ('JOGAR', 'PLATEIA')),
  unique (torneio_id, utilizador_id)
);


-- ----------------------------------------------------------
-- 5. PARTIDAS (árvore do torneio)
-- ----------------------------------------------------------
create table public.partidas (
  id          uuid primary key default gen_random_uuid(),
  torneio_id  uuid not null references public.torneios(id) on delete cascade,
  ronda       int not null,
  posicao     int not null,
  jogador1_id uuid references public.profiles(id) on delete set null,
  jogador2_id uuid references public.profiles(id) on delete set null,
  vencedor_id uuid references public.profiles(id) on delete set null,
  estado      jsonb not null default '{}'::jsonb,
  status      text not null default 'A_JOGAR' check (status in ('A_JOGAR','TERMINADO')),
  revelar_ate timestamptz,
  created_at  timestamptz not null default now()
);

-- FK da partida em destaque (criada agora que 'partidas' existe)
alter table public.torneios
  add constraint torneios_partida_destaque_fkey
  foreign key (partida_destaque_id) references public.partidas(id) on delete set null;


-- ----------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ----------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.torneios               enable row level security;
alter table public.torneio_participantes  enable row level security;
alter table public.partidas               enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Torneios
create policy "torneios_select" on public.torneios
  for select using (auth.role() = 'authenticated');
create policy "torneios_insert_admin" on public.torneios
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );
create policy "torneios_update_admin" on public.torneios
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );

-- Participantes
create policy "participantes_select" on public.torneio_participantes
  for select using (auth.role() = 'authenticated');
create policy "participantes_insert" on public.torneio_participantes
  for insert with check (auth.role() = 'authenticated');
create policy "participantes_update_admin" on public.torneio_participantes
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );

-- Partidas
create policy "partidas_select" on public.partidas
  for select using (auth.role() = 'authenticated');
create policy "partidas_insert_admin" on public.partidas
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );


-- ----------------------------------------------------------
-- 7. STORAGE — Bucket de avatares
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ----------------------------------------------------------
-- 8. FUNÇÃO — Adicionar bot (perfil + inscrição em "aguardar")
-- ----------------------------------------------------------
create or replace function public.adicionar_bot(p_torneio_id uuid, p_nome text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and admin = true) then
    raise exception 'Apenas admins podem adicionar bots';
  end if;

  insert into public.profiles (id, username, name, admin, is_bot)
  values (v_id, 'bot_' || substr(v_id::text, 1, 8), p_nome, false, true);

  insert into public.torneio_participantes (torneio_id, utilizador_id, status_inscricao, moedas)
  values (p_torneio_id, v_id, 'QUER_JOGAR', 100);
end; $$;

grant execute on function public.adicionar_bot(uuid, text) to authenticated;


-- ----------------------------------------------------------
-- 9. FUNÇÃO — Jogar Pedra-Papel-Tesoura (à melhor de 3)
-- Resolução atómica no servidor.
-- p_jogador_id: opcional — admins personificam bots.
-- Revelação de 5 segundos (revelar_ate) entre jogadas/no final.
-- ----------------------------------------------------------
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

    -- 5 segundos de revelação em qualquer caso (inclui o ponto final)
    if v_p1 >= 2 then
      update public.partidas set estado=v_e, vencedor_id=jogador1_id, status='TERMINADO',
        revelar_ate = now() + interval '5 seconds' where id=p_partida_id; return;
    elsif v_p2 >= 2 then
      update public.partidas set estado=v_e, vencedor_id=jogador2_id, status='TERMINADO',
        revelar_ate = now() + interval '5 seconds' where id=p_partida_id; return;
    end if;
    update public.partidas set estado=v_e, revelar_ate = now() + interval '5 seconds' where id=p_partida_id; return;
  end if;

  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;

grant execute on function public.jogar_ppt(uuid, text, uuid) to authenticated;


-- ----------------------------------------------------------
-- 9b. FUNÇÃO — Jogar Jogo do Galo (Tic-Tac-Toe 3×3)
-- Resolução atómica no servidor. Empate reinicia o tabuleiro e
-- troca quem começa (revelação 3s); vitória termina (revelação 5s).
-- Estado: { tabuleiro:[1|2|null]*9, vez:1|2, comeca:1|2, empates:int, linha_vencedora:int[]|null }
-- ----------------------------------------------------------
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
    array[0,1,2], array[3,4,5], array[6,7,8],
    array[0,3,6], array[1,4,7], array[2,5,8],
    array[0,4,8], array[2,4,6]
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
  if v.revelar_ate is not null and now() < v.revelar_ate then return; end if;

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

  v_tab := jsonb_set(v_tab, array[p_pos::text], to_jsonb(v_slot));

  foreach v_l slice 1 in array v_lines loop
    if (v_tab->>(v_l[1]))::int = v_slot
       and (v_tab->>(v_l[2]))::int = v_slot
       and (v_tab->>(v_l[3]))::int = v_slot then
      v_ganhou := true; v_linha := v_l; exit;
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

  for i in 0..8 loop
    if v_tab->>i is null then v_full := false; exit; end if;
  end loop;

  if v_full then
    v_comeca := case when v_comeca = 1 then 2 else 1 end;
    v_empates := v_empates + 1;
    v_e := jsonb_set(v_e, '{tabuleiro}', '[null,null,null,null,null,null,null,null,null]'::jsonb);
    v_e := jsonb_set(v_e, '{vez}', to_jsonb(v_comeca));
    v_e := jsonb_set(v_e, '{comeca}', to_jsonb(v_comeca));
    v_e := jsonb_set(v_e, '{empates}', to_jsonb(v_empates));
    update public.partidas set estado = v_e, revelar_ate = now() + interval '3 seconds' where id = p_partida_id;
    return;
  end if;

  v_e := jsonb_set(v_e, '{vez}', to_jsonb(case when v_slot = 1 then 2 else 1 end));
  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;

grant execute on function public.jogar_galo(uuid, int, uuid) to authenticated;


-- ----------------------------------------------------------
-- 9c. FUNÇÃO — Jogar Quatro em Linha (Connect Four 7×6)
-- Resolução atómica no servidor. Peça cai por gravidade na coluna.
-- Empate (tabuleiro cheio) reinicia e troca quem começa (revelação 3s);
-- vitória (4 em linha) termina (revelação 5s).
-- Estado: { tabuleiro:[1|2|null]*42, vez:1|2, comeca:1|2, empates:int, linha_vencedora:int[]|null }
-- Índice = linha*7 + coluna (linha 0 = topo, linha 5 = fundo).
-- ----------------------------------------------------------
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

  -- Gravidade: casa livre mais baixa da coluna
  for r in reverse 5..0 loop
    if v_tab->>(r*7 + p_coluna) is null then v_row := r; exit; end if;
  end loop;
  if v_row = -1 then raise exception 'Coluna cheia'; end if;

  v_tab := jsonb_set(v_tab, array[(v_row*7 + p_coluna)::text], to_jsonb(v_slot));

  foreach v_d slice 1 in array v_dirs loop
    v_dr := v_d[1]; v_dc := v_d[2];
    v_cells := array[v_row*7 + p_coluna];
    r := v_row + v_dr; c := p_coluna + v_dc;
    while r >= 0 and r <= 5 and c >= 0 and c <= 6 and (v_tab->>(r*7+c))::int = v_slot loop
      v_cells := v_cells || (r*7+c); r := r + v_dr; c := c + v_dc;
    end loop;
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

  v_e := jsonb_set(v_e, '{vez}', to_jsonb(case when v_slot = 1 then 2 else 1 end));
  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;

grant execute on function public.jogar_quatro(uuid, int, uuid) to authenticated;


-- ----------------------------------------------------------
-- 9d. BATALHA NAVAL (Battleship 5×5)
-- Navios escondidos numa tabela à parte com RLS SEM políticas:
-- nenhum cliente lê diretamente; só funções security definer acedem.
-- Cada jogador obtém os SEUS navios via obter_navios; o admin obtém
-- os dos bots que controla. Frota de tamanhos variados: 3, 2, 1.
-- Há FASE DE POSICIONAMENTO (posicionar_navios valida a colocação);
-- quando ambos prontos → fase COMBATE. estado público guarda só os
-- tiros (água/acerto) + restantes + flags de pronto + fase.
-- ----------------------------------------------------------
create table if not exists public.partida_navios (
  partida_id uuid not null references public.partidas(id) on delete cascade,
  jogador_id uuid not null references public.profiles(id) on delete cascade,
  navios     jsonb not null,
  primary key (partida_id, jogador_id)
);
alter table public.partida_navios enable row level security;
-- (sem políticas — acesso só via funções security definer)

-- Limpa funções da versão antiga (colocação automática)
drop function if exists public.garantir_navios(uuid);
drop function if exists public.gerar_frota_naval();

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

  for v_navio in select value from jsonb_array_elements(p_navios) loop
    v_ship := array(select (e.value)::int from jsonb_array_elements_text(v_navio) e order by (e.value)::int);
    v_len := coalesce(array_length(v_ship,1), 0);
    if v_len = 0 then raise exception 'Navio vazio'; end if;

    foreach i in array v_ship loop
      if i < 0 or i > 24 then raise exception 'Casa fora da grelha'; end if;
    end loop;

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

  if (array(select l from unnest(v_lens) l order by l)) <> array[1,2,3] then
    raise exception 'A frota tem de ter navios de tamanho 3, 2 e 1';
  end if;
  if array_length(v_cells,1) <> (select count(distinct cc) from unnest(v_cells) cc) then
    raise exception 'Os navios não se podem sobrepor';
  end if;

  insert into public.partida_navios (partida_id, jogador_id, navios)
    values (p_partida_id, v_acting, p_navios)
    on conflict (partida_id, jogador_id) do update set navios = excluded.navios;

  v_e := jsonb_set(v_e, array['pronto_'||v_slot], 'true'::jsonb);

  if coalesce((v_e->>'pronto_1')::boolean,false) and coalesce((v_e->>'pronto_2')::boolean,false) then
    v_e := jsonb_set(v_e, '{fase}', '"COMBATE"');
    v_e := jsonb_set(v_e, '{restantes_1}', to_jsonb(6));
    v_e := jsonb_set(v_e, '{restantes_2}', to_jsonb(6));
    v_e := jsonb_set(v_e, '{vez}', to_jsonb(1));
  end if;

  update public.partidas set estado = v_e where id = p_partida_id;
end; $$;
grant execute on function public.posicionar_navios(uuid, jsonb, uuid) to authenticated;

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

  v_e := v.estado;
  v_vez := coalesce((v_e->>'vez')::int, 1);
  if v_slot <> v_vez then raise exception 'Não é a tua vez'; end if;

  if coalesce(v_e->>'fase','COMBATE') <> 'COMBATE' then
    raise exception 'A frota ainda está a ser posicionada';
  end if;

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


-- ----------------------------------------------------------
-- 10. FUNÇÃO — Apagar torneio (e tudo associado, removendo bots)
-- ----------------------------------------------------------
create or replace function public.apagar_torneio(p_torneio_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_bots uuid[];
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and admin = true) then
    raise exception 'Apenas admins podem apagar torneios';
  end if;

  -- recolher os bots associados a este torneio
  select array_agg(tp.utilizador_id) into v_bots
  from public.torneio_participantes tp
  join public.profiles p on p.id = tp.utilizador_id
  where tp.torneio_id = p_torneio_id and p.is_bot;

  delete from public.partidas where torneio_id = p_torneio_id;
  delete from public.torneio_participantes where torneio_id = p_torneio_id;
  delete from public.torneios where id = p_torneio_id;

  -- apagar os perfis dos bots (mantém os jogadores reais)
  if v_bots is not null then
    delete from public.profiles where id = any(v_bots) and is_bot;
  end if;
end; $$;

grant execute on function public.apagar_torneio(uuid) to authenticated;


-- ----------------------------------------------------------
-- 10b. FUNÇÃO — Definir a minha preferência (utilizador normal)
-- Permite escolher JOGAR/PLATEIA sem ser admin. Só funciona enquanto
-- o torneio estiver em LOBBY e o admin ainda não tiver decidido
-- (status_inscricao = 'QUER_JOGAR').
-- ----------------------------------------------------------
create or replace function public.definir_minha_preferencia(
  p_torneio_id uuid,
  p_pref text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_torneio_status text;
begin
  if p_pref not in ('JOGAR', 'PLATEIA') then raise exception 'Preferência inválida'; end if;
  if v_uid is null then raise exception 'Não autenticado'; end if;

  select status into v_torneio_status from public.torneios where id = p_torneio_id;
  if v_torneio_status is null then raise exception 'Torneio não existe'; end if;
  if v_torneio_status <> 'LOBBY' then
    raise exception 'O torneio já começou — já não podes mudar a tua escolha';
  end if;

  select status_inscricao into v_status
    from public.torneio_participantes
    where torneio_id = p_torneio_id and utilizador_id = v_uid;

  if v_status is null then raise exception 'Não estás inscrito neste torneio'; end if;
  if v_status <> 'QUER_JOGAR' then
    raise exception 'O admin já decidiu a tua posição';
  end if;

  update public.torneio_participantes
    set preferencia = p_pref
    where torneio_id = p_torneio_id and utilizador_id = v_uid;
end; $$;

grant execute on function public.definir_minha_preferencia(uuid, text) to authenticated;


-- ----------------------------------------------------------
-- 11. REALTIME — publicar tabelas + replica identity
-- (necessário para a sincronização em tempo real no frontend)
-- ----------------------------------------------------------
alter table public.torneios               replica identity full;
alter table public.torneio_participantes  replica identity full;
alter table public.partidas               replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.torneios;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.torneio_participantes;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.partidas;
exception when duplicate_object then null; end $$;


-- ----------------------------------------------------------
-- 12. CRIAR ADMIN (exemplo)
-- Depois de criares o utilizador no Auth e teres o perfil:
--   update public.profiles set admin = true where username = 'oteu_username';
-- ----------------------------------------------------------
