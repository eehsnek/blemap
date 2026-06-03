-- Run in Supabase SQL editor (profiles/roles/precase may already exist)

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  summary text not null default '',
  pain_count int not null default 0,
  solve_count int not null default 0,
  lifecycle_state text not null default 'grey'
    check (lifecycle_state in ('grey', 'orange', 'green')),
  claimed_by uuid references auth.users (id) on delete set null,
  mode text default 'community',
  subreddits text[] not null default '{}',
  permalinks text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists case_pain_votes (
  case_id uuid not null references cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create table if not exists solves (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  solve_text text not null,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_solves_case_id on solves (case_id);

alter table cases enable row level security;
alter table case_pain_votes enable row level security;
alter table solves enable row level security;

-- Service role bypasses RLS; anon policies for read-only matrix (adjust per product spec)
create policy "Anyone can read cases"
  on cases for select
  using (true);

create policy "Authenticated users can read solves"
  on solves for select
  to authenticated
  using (true);
