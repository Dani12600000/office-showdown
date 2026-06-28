-- ==========================================================
-- MIGRAÇÃO 010 — Desempate determinístico do "Maior apostador"
-- A página pública e o projetor escolhiam vencedores diferentes em caso de
-- empate no lucro (sem critério de desempate). Agora ambos usam a mesma regra:
--   maior lucro → quem chegou primeiro (aposta mais antiga) → id (estável).
-- Correr no Supabase SQL Editor. (Idempotente.)
-- ==========================================================

create or replace function public.resultado_publico(p_torneio_id uuid)
returns json
language sql
security definer
stable
set search_path = public
as $$
  with t as (
    select id, nome, status, vencedor_id
    from public.torneios
    where id = p_torneio_id
  ),
  campeao as (
    select pr.id, pr.name, pr.avatar_url
    from public.profiles pr
    join t on pr.id = t.vencedor_id
  ),
  -- Maior apostador: maior lucro líquido (>0). Desempate: aposta mais antiga
  -- (quem chegou primeiro) e, por fim, o id — igual ao cálculo do cliente.
  melhor as (
    select pr.name, pr.avatar_url, sum(a.ganho)::int as ganho
    from public.apostas a
    join public.partidas p on p.id = a.partida_id
    join t on p.torneio_id = t.id
    join public.profiles pr on pr.id = a.apostador_id
    group by pr.id, pr.name, pr.avatar_url
    having sum(a.ganho) > 0
    order by sum(a.ganho) desc, min(a.created_at) asc, pr.id asc
    limit 1
  )
  select json_build_object(
    'nome',    (select nome   from t),
    'status',  (select status from t),
    'campeao', (select row_to_json(campeao) from campeao),
    'melhor',  (select row_to_json(melhor)  from melhor)
  );
$$;

grant execute on function public.resultado_publico(uuid) to anon, authenticated;
