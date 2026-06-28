-- ==========================================================
-- MIGRAÇÃO 013 — Pote sem apostas no vencedor vai para o jogador vencedor
-- Antes: se ninguém apostou no vencedor, todas as apostas perdiam e o pote
-- "desaparecia". Agora esse pote é entregue ao JOGADOR que venceu a partida
-- (recompensa o azarão que ninguém apoiou). Correr no Supabase SQL Editor.
-- (Idempotente.)
-- ==========================================================

create or replace function public.liquidar_apostas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pool_total int; v_pool_venc int; v_payout int; r record;
begin
  if new.status = 'TERMINADO' and (old.status is distinct from 'TERMINADO') then
    select coalesce(sum(montante),0) into v_pool_total from public.apostas where partida_id = new.id;
    if v_pool_total = 0 then return new; end if;

    select coalesce(sum(montante),0) into v_pool_venc
      from public.apostas where partida_id = new.id and alvo_id = new.vencedor_id;

    if v_pool_venc = 0 then
      -- Ninguém apostou no vencedor → o pote inteiro vai para o jogador vencedor.
      if new.vencedor_id is not null then
        update public.torneio_participantes
          set moedas = moedas + v_pool_total
          where torneio_id = new.torneio_id and utilizador_id = new.vencedor_id;
      end if;
      update public.apostas set liquidada = true, ganho = -montante
        where partida_id = new.id and not liquidada;
      return new;
    end if;

    for r in select * from public.apostas where partida_id = new.id and not liquidada loop
      if r.alvo_id = new.vencedor_id then
        v_payout := floor(r.montante::numeric * v_pool_total / v_pool_venc)::int;
        update public.torneio_participantes set moedas = moedas + v_payout
          where torneio_id = new.torneio_id and utilizador_id = r.apostador_id;
        update public.apostas set liquidada = true, ganho = v_payout - r.montante where id = r.id;
      else
        update public.apostas set liquidada = true, ganho = -r.montante where id = r.id;
      end if;
    end loop;
  end if;
  return new;
end; $$;
