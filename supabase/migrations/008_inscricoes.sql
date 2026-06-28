-- ==========================================================
-- MIGRAÇÃO 008 — Fechar inscrições do lobby
-- O admin pode fechar o lobby (não entra mais ninguém). Fecha-se
-- automaticamente ao "Sortear elenco" e pode abrir/fechar à mão.
-- Correr no Supabase SQL Editor sobre o schema já existente. (Idempotente.)
-- ==========================================================

alter table public.torneios
  add column if not exists inscricoes_abertas boolean not null default true;

-- ----------------------------------------------------------
-- A inscrição (insert direto do cliente) só é permitida quando:
--   • o utilizador se inscreve a si próprio (utilizador_id = auth.uid())
--   • o torneio está em LOBBY e com inscrições abertas
-- Os bots continuam a ser adicionados via RPC `adicionar_bot`
-- (security definer → ignora RLS), por isso não são afetados.
-- ----------------------------------------------------------
drop policy if exists "participantes_insert" on public.torneio_participantes;
create policy "participantes_insert" on public.torneio_participantes
  for insert with check (
    auth.role() = 'authenticated'
    and utilizador_id = auth.uid()
    and exists (
      select 1 from public.torneios t
      where t.id = torneio_id
        and t.status = 'LOBBY'
        and coalesce(t.inscricoes_abertas, true)
    )
  );
