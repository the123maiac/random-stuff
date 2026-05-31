-- A vibe-coded app: a chat thread plus the latest generated single-file HTML
-- document. `current_html` is the rendered artifact; the chat lives in
-- project_messages.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled app',
  -- The provider key + model this project generates with. Nulled if the
  -- connection is later removed, so the user is prompted to pick a new one.
  connection_id uuid references public.provider_connections (id) on delete set null,
  model text,
  current_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "own projects - select"
  on public.projects for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own projects - insert"
  on public.projects for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own projects - update"
  on public.projects for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own projects - delete"
  on public.projects for delete to authenticated
  using (user_id = (select auth.uid()));

-- Chat history for a project. Written server-side during generation; readable
-- by the owner to render the thread.
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_messages_project_idx
  on public.project_messages (project_id, created_at);

alter table public.project_messages enable row level security;

create policy "own project messages - select"
  on public.project_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own project messages - insert"
  on public.project_messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own project messages - delete"
  on public.project_messages for delete to authenticated
  using (user_id = (select auth.uid()));
