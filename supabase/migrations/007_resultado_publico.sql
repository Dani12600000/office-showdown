-- ==========================================================
-- MIGRAÇÃO 007 — Resultado público (página de partilha / OG image)
-- A página /torneio/[id]/resultado é PÚBLICA (sem login) para que o WhatsApp/
-- Facebook consigam gerar a pré-visualização ao partilhar. Como as tabelas têm
-- RLS só-autenticados, expomos APENAS o resultado via esta RPC security definer
-- (bypassa RLS) concedida a anon. Devolve só dados não-sensíveis do campeão.
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
  -- Maior apostador: quem ganhou mais moedas no torneio (maior lucro líquido > 0)
  melhor as (
    select pr.name, pr.avatar_url, sum(a.ganho)::int as ganho
    from public.apostas a
    join public.partidas p on p.id = a.partida_id
    join t on p.torneio_id = t.id
    join public.profiles pr on pr.id = a.apostador_id
    group by pr.id, pr.name, pr.avatar_url
    having sum(a.ganho) > 0
    order by sum(a.ganho) desc
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
