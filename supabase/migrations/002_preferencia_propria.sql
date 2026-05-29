-- ==========================================================
-- MIGRAÇÃO 002 — Cada utilizador pode definir a sua preferência
-- (sem ser admin), enquanto o torneio estiver em LOBBY e o admin
-- ainda não tiver decidido (status_inscricao = 'QUER_JOGAR').
-- ==========================================================

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
  if p_pref not in ('JOGAR', 'PLATEIA') then
    raise exception 'Preferência inválida';
  end if;
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

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
