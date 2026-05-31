-- Publishing: a project can be snapshotted into a public, addressable site.
-- `published_sites.html` is an immutable copy of the project's current_html at
-- publish time, served read-only over the app's TLS at /s/<slug>. Optional
-- custom domains let a verified hostname serve the same snapshot at its root.

create table if not exists public.published_sites (
  id uuid primary key default gen_random_uuid(),
  -- One live site per project; re-publishing overwrites the snapshot.
  project_id uuid not null unique references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Unguessable public path component (see src/lib/publish/slug.ts).
  slug text not null unique,
  html text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists published_sites_user_idx on public.published_sites (user_id);

create trigger published_sites_set_updated_at
  before update on public.published_sites
  for each row execute function public.set_updated_at();

alter table public.published_sites enable row level security;

-- Owners manage their own sites. Public serving uses the service-role client,
-- which bypasses RLS, so no anonymous read policy is needed.
create policy "own sites - select"
  on public.published_sites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own sites - insert"
  on public.published_sites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own sites - update"
  on public.published_sites for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own sites - delete"
  on public.published_sites for delete to authenticated
  using (user_id = (select auth.uid()));

-- A user-owned hostname pointed at a published site. `verified_at` is set once
-- the DNS TXT challenge is confirmed; only verified hostnames are served. TLS
-- for the hostname is issued by the hosting platform once DNS resolves to it.
create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.published_sites (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Stored lowercased + normalized; globally unique so a host maps to one site.
  hostname text not null unique,
  verification_token text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists custom_domains_site_idx on public.custom_domains (site_id);

alter table public.custom_domains enable row level security;

create policy "own domains - select"
  on public.custom_domains for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own domains - insert"
  on public.custom_domains for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own domains - update"
  on public.custom_domains for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own domains - delete"
  on public.custom_domains for delete to authenticated
  using (user_id = (select auth.uid()));
