-- ==========================================================
-- MIGRAÇÃO 009 — Verificar disponibilidade de username no registo
-- A tabela profiles já tem `username unique`, mas a verificação amigável
-- no cliente falhava: corre como ANÓNIMO e o RLS de profiles só deixa o
-- select a autenticados → devolvia sempre "livre" e o utilizador via um
-- erro genérico de BD ao duplicar.
-- Esta RPC security definer (acessível a anon) responde se o username
-- está livre, sem expor a tabela. Correr no Supabase SQL Editor. (Idempotente.)
-- ==========================================================

create or replace function public.username_disponivel(p_username text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where username = lower(trim(p_username))
  );
$$;

grant execute on function public.username_disponivel(text) to anon, authenticated;
