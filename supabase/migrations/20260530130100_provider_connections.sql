-- A user's stored credential for one AI provider. The raw API key is never
-- stored: `encrypted_key` holds an AES-256-GCM envelope token and `key_version`
-- records which master key sealed it (so keys can be rotated).

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_type text not null check (
    provider_type in (
      'openai',
      'groq',
      'nvidia',
      'openrouter',
      'ollama',
      'custom_openai',
      'anthropic'
    )
  ),
  label text not null,
  encrypted_key text not null,
  key_version integer not null,
  -- Only set for providers with a user-supplied endpoint (ollama, custom).
  base_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, provider_type, label)
);

create index if not exists provider_connections_user_id_idx
  on public.provider_connections (user_id);

create trigger provider_connections_set_updated_at
  before update on public.provider_connections
  for each row execute function public.set_updated_at();

alter table public.provider_connections enable row level security;

-- A user may only ever touch their own rows. `(select auth.uid())` lets the
-- planner cache the value once per statement instead of per row.
create policy "own connections - select"
  on public.provider_connections for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "own connections - insert"
  on public.provider_connections for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "own connections - update"
  on public.provider_connections for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own connections - delete"
  on public.provider_connections for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Defense in depth: even the owning user must never read the ciphertext or key
-- version through the browser-facing API. Decryption happens server-side only,
-- via the service-role client (which bypasses these column grants).
revoke select (encrypted_key, key_version)
  on public.provider_connections from anon, authenticated;
