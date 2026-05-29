-- ==========================================================
-- OFFICE SHOWDOWN — Schema completo
-- Correr no Supabase SQL Editor (Dashboard → SQL Editor)
-- ==========================================================


-- ----------------------------------------------------------
-- 1. PROFILES
-- Dados públicos dos utilizadores, ligados ao auth.users
-- ----------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  name       text not null,
  admin      boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Trigger: cria automaticamente um perfil quando um utilizador
-- é criado no Supabase Auth (via Dashboard ou convite de Admin)
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
-- 2. RPC — Resolver username → email
-- Necessário para o login com username em vez de email
-- security definer permite aceder a auth.users
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

-- Necessário para que o cliente anónimo consiga chamar a função antes do login
grant execute on function public.get_email_by_username(text) to anon, authenticated;


-- ----------------------------------------------------------
-- 3. TORNEIOS
-- ----------------------------------------------------------
create table public.torneios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  status      text not null default 'LOBBY'
                check (status in ('LOBBY', 'ARVORE', 'JOGO', 'FINAL')),
  ronda_atual int  not null default 1
                check (ronda_atual between 1 and 4),
  ativo       boolean not null default true,
  criado_por  uuid references public.profiles(id) on delete set null,
  vencedor_id uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
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
  unique (torneio_id, utilizador_id)
);


-- ----------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- Política simples: utilizadores autenticados leem tudo;
-- só admins (verificado via perfil) escrevem em torneios.
-- ----------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.torneios            enable row level security;
alter table public.torneio_participantes enable row level security;

-- Profiles: qualquer autenticado lê; cada um edita o seu próprio
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Torneios: leitura livre para autenticados
create policy "torneios_select" on public.torneios
  for select using (auth.role() = 'authenticated');

-- Torneios: escrita apenas para admins
create policy "torneios_insert_admin" on public.torneios
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );

create policy "torneios_update_admin" on public.torneios
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );

-- Participantes: leitura livre; qualquer autenticado pode inscrever-se
create policy "participantes_select" on public.torneio_participantes
  for select using (auth.role() = 'authenticated');

create policy "participantes_insert" on public.torneio_participantes
  for insert with check (auth.role() = 'authenticated');

create policy "participantes_update_admin" on public.torneio_participantes
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );


-- ----------------------------------------------------------
-- 6. STORAGE — Bucket de avatares
-- Correr no SQL Editor do Supabase
-- ----------------------------------------------------------

-- Criar o bucket público
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Qualquer pessoa pode ver avatares (URLs públicas)
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Cada utilizador só pode fazer upload na sua própria pasta ({userId}/...)
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Cada utilizador pode atualizar o seu próprio avatar
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Cada utilizador pode apagar o seu próprio avatar
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- ----------------------------------------------------------
-- 7. CRIAR UTILIZADORES (exemplo de uso)
-- Usar no Dashboard: Authentication → Users → "Add user"
-- Metadata a passar em raw_user_meta_data:
--   { "username": "jsilva", "name": "João Silva", "admin": false }
-- O trigger cria o perfil automaticamente.
-- ----------------------------------------------------------
