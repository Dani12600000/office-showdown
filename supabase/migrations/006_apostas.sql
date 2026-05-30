-- ==========================================================
-- MIGRAÇÃO 006 — Sistema de Apostas (parimutuel)
-- A plateia aposta moedas num dos 2 jogadores da partida em destaque.
-- Admin abre (ao apresentar) e fecha as apostas; ao terminar a partida,
-- um trigger distribui o pote (vencedores dividem proporcionalmente).
-- ==========================================================

-- Janela de apostas da partida em destaque
alter table public.torneios add column if not exists apostas_abertas boolean not null default false;

-- ----------------------------------------------------------
-- Tabela de apostas
-- ----------------------------------------------------------
create table if not exists public.apostas (
  id            uuid primary key default gen_random_uuid(),
  partida_id    uuid not null references public.partidas(id) on delete cascade,
  apostador_id  uuid not null references public.profiles(id) on delete cascade,
  alvo_id       uuid not null references public.profiles(id) on delete cascade,
  montante      int  not null check (montante > 0),
  ganho         int  not null default 0,     -- líquido após liquidação (+ganho / -perda)
  liquidada     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (partida_id, apostador_id)
);

alter table public.apostas enable row level security;
-- Leitura aberta (para gráficos/transparência); escrita só via RPC.
create policy "apostas_select" on public.apostas
  for select using (auth.role() = 'authenticated');


-- ----------------------------------------------------------
-- RPC — Apostar (escrow: desconta as moedas na hora)
-- p_apostador_id: opcional (admins personificam bots da plateia).
-- ----------------------------------------------------------
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

  -- Quem aposta? (próprio, ou bot da plateia personificado por admin)
  if p_apostador_id is null or p_apostador_id = v_uid then
    v_acting := v_uid;
  else
    select admin  into v_sou_admin from public.profiles where id = v_uid;
    select is_bot into v_alvo_bot  from public.profiles where id = p_apostador_id;
    if not coalesce(v_sou_admin,false) then raise exception 'Apenas admins podem apostar por outros'; end if;
    if not coalesce(v_alvo_bot,false)  then raise exception 'Só podes personificar bots'; end if;
    v_acting := p_apostador_id;
  end if;

  -- Tem de ser PLATEIA neste torneio
  select * into v_part from public.torneio_participantes
    where torneio_id = v.torneio_id and utilizador_id = v_acting
    for update;
  if v_part.id is null then raise exception 'Não estás inscrito neste torneio'; end if;
  if v_part.status_inscricao <> 'PLATEIA' then raise exception 'Só a plateia pode apostar'; end if;

  if v_part.moedas < p_montante then raise exception 'Moedas insuficientes'; end if;

  -- Aposta já existente? (pode reforçar no mesmo jogador; não pode trocar de lado)
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


-- ----------------------------------------------------------
-- Trigger — Liquidação parimutuel quando a partida termina
-- Vencedores dividem o pote total proporcionalmente ao que apostaram.
-- (As moedas já foram descontadas na aposta; aqui creditamos o payout.)
-- ----------------------------------------------------------
create or replace function public.liquidar_apostas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pool_total int;
  v_pool_venc int;
  v_payout int;
  r record;
begin
  if new.status = 'TERMINADO' and (old.status is distinct from 'TERMINADO') then
    select coalesce(sum(montante),0) into v_pool_total from public.apostas where partida_id = new.id;
    if v_pool_total = 0 then return new; end if;

    select coalesce(sum(montante),0) into v_pool_venc
      from public.apostas where partida_id = new.id and alvo_id = new.vencedor_id;

    if v_pool_venc = 0 then
      -- Ninguém acertou no vencedor → todas perdem
      update public.apostas set liquidada = true, ganho = -montante
        where partida_id = new.id and not liquidada;
      return new;
    end if;

    for r in select * from public.apostas where partida_id = new.id and not liquidada loop
      if r.alvo_id = new.vencedor_id then
        v_payout := floor(r.montante::numeric * v_pool_total / v_pool_venc)::int;
        update public.torneio_participantes
          set moedas = moedas + v_payout
          where torneio_id = new.torneio_id and utilizador_id = r.apostador_id;
        update public.apostas set liquidada = true, ganho = v_payout - r.montante where id = r.id;
      else
        update public.apostas set liquidada = true, ganho = -r.montante where id = r.id;
      end if;
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists trg_liquidar_apostas on public.partidas;
create trigger trg_liquidar_apostas
  after update on public.partidas
  for each row execute function public.liquidar_apostas();


-- ----------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------
alter table public.apostas replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.apostas;
exception when duplicate_object then null; end $$;
