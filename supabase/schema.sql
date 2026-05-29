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
