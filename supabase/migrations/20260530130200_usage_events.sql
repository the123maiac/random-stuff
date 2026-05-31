-- One row per completed chat request. Powers per-user usage history and the
-- sliding-window rate limiter in the gateway. Rows are written server-side via
-- the service-role client; users can read their own but never insert/forge.

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.provider_connections (id) on delete set null,
  provider_type text not null,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

-- Serves both "my recent usage" listing and the rate-limiter's window count.
create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;

create policy "own usage - select"
  on public.usage_events for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policy for authenticated: only the service role
-- (which bypasses RLS) writes usage, keeping the rate-limit counts honest.
