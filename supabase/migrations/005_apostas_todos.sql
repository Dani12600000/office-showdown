-- ==========================================================
-- MIGRAÇÃO 005 — Apostas abertas a TODA a gente
-- Correr no Supabase SQL Editor sobre o schema já existente.
-- (Idempotente — pode correr-se mais que uma vez.)
-- ==========================================================
--
-- Antes: só quem estava na PLATEIA podia apostar.
-- Agora: qualquer participante pode apostar na partida em destaque —
--   plateia, jogadores eliminados e quem ainda espera a sua vez — para
--   continuarem envolvidos mesmo depois de perderem.
--   Única exceção: os DOIS jogadores da própria partida em destaque não
--   podem apostar nela.
--
-- Só muda a função `apostar` (CREATE OR REPLACE). Sem alterações de tabelas.
-- ==========================================================

create or replace function public.apostar(
  p_partida_id uuid,
  p_alvo_id uuid,
  p_montante int,
  p_apostador_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.partidas;
  vt public.torneios;
  v_uid uuid := auth.uid();
  v_acting uuid;
  v_sou_admin boolean; v_alvo_bot boolean;
  v_part public.torneio_participantes;
  v_existe public.apostas;
begin
  if p_montante <= 0 then raise exception 'Montante inválido'; end if;

  select * into v from public.partidas where id = p_partida_id;
  if v.id is null then raise exception 'Partida não existe'; end if;

  select * into vt from public.torneios where id = v.torneio_id;
  if not coalesce(vt.apostas_abertas, false) then raise exception 'As apostas estão fechadas'; end if;
  if vt.partida_destaque_id is distinct from p_partida_id then
    raise exception 'Só podes apostar na partida em destaque'; end if;
  if v.status <> 'A_JOGAR' then raise exception 'Esta partida não aceita apostas'; end if;
  if p_alvo_id is distinct from v.jogador1_id and p_alvo_id is distinct from v.jogador2_id then
    raise exception 'Tens de apostar num dos dois jogadores'; end if;

  if p_apostador_id is null or p_apostador_id = v_uid then
    v_acting := v_uid;
  else
    select admin  into v_sou_admin from public.profiles where id = v_uid;
    select is_bot into v_alvo_bot  from public.profiles where id = p_apostador_id;
    if not coalesce(v_sou_admin,false) then raise exception 'Apenas admins podem apostar por outros'; end if;
    if not coalesce(v_alvo_bot,false)  then raise exception 'Só podes personificar bots'; end if;
    v_acting := p_apostador_id;
  end if;

  select * into v_part from public.torneio_participantes
    where torneio_id = v.torneio_id and utilizador_id = v_acting for update;
  if v_part.id is null then raise exception 'Não estás inscrito neste torneio'; end if;
  -- Toda a gente pode apostar (plateia, eliminados, quem espera a vez) — exceto
  -- os dois jogadores da própria partida em destaque.
  if v_acting = v.jogador1_id or v_acting = v.jogador2_id then
    raise exception 'Não podes apostar na tua própria partida'; end if;
  if v_part.moedas < p_montante then raise exception 'Moedas insuficientes'; end if;

  select * into v_existe from public.apostas
    where partida_id = p_partida_id and apostador_id = v_acting;

  if v_existe.id is not null then
    if v_existe.alvo_id <> p_alvo_id then raise exception 'Já apostaste no outro jogador'; end if;
    update public.torneio_participantes set moedas = moedas - p_montante where id = v_part.id;
    update public.apostas set montante = montante + p_montante where id = v_existe.id;
  else
    update public.torneio_participantes set moedas = moedas - p_montante where id = v_part.id;
    insert into public.apostas (partida_id, apostador_id, alvo_id, montante)
      values (p_partida_id, v_acting, p_alvo_id, p_montante);
  end if;
end; $$;
grant execute on function public.apostar(uuid, uuid, int, uuid) to authenticated;
