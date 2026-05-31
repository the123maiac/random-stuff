-- Fixed-window request counter for the chat gateway. Kept correct across
-- multiple server instances by doing the increment atomically inside Postgres
-- rather than in process memory.

create table if not exists public.rate_limit_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, window_start)
);

-- Only the service role touches this table; RLS-on with no policy denies
-- everyone else outright.
alter table public.rate_limit_counters enable row level security;

-- Atomically bumps the caller's counter for the current window and reports
-- whether they are still within `p_limit`. SECURITY DEFINER so it can write the
-- locked-down table; EXECUTE is revoked from end-user roles below.
create or replace function public.bump_rate_limit(
  p_user_id uuid,
  p_window_seconds integer,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (user_id, window_start, count)
  values (p_user_id, v_window_start, 1)
  on conflict (user_id, window_start)
  do update set count = rate_limit_counters.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.bump_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.bump_rate_limit(uuid, integer, integer)
  to service_role;

-- Housekeeping: prune counters older than a day. Wire to pg_cron in prod;
-- harmless to call manually meanwhile.
create or replace function public.prune_rate_limit_counters()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_counters where window_start < now() - interval '1 day';
$$;

revoke execute on function public.prune_rate_limit_counters() from public, anon, authenticated;
grant execute on function public.prune_rate_limit_counters() to service_role;
