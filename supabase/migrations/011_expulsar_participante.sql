-- ==========================================================
-- MIGRAÇÃO 011 — Expulsar participantes do lobby (admin)
-- Permite ao admin remover um participante (ex.: contas repetidas).
-- Faltava policy de DELETE em torneio_participantes (o RLS bloqueava tudo).
-- Correr no Supabase SQL Editor. (Idempotente.)
-- ==========================================================

drop policy if exists "participantes_delete_admin" on public.torneio_participantes;
create policy "participantes_delete_admin" on public.torneio_participantes
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and admin = true)
  );
