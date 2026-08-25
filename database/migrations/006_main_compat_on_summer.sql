-- BleMap Main SPA compatibility on the existing Summer Supabase project
-- Project: https://kktedcwrxsrkbyzxchjt.supabase.co
--
-- Summer already has: cases (bigint id), case_solves, case_pains, case_claims,
-- precase, users, submissions.
-- Main expects: solves, case_pain_votes, case_confirmations, case_events,
-- scrape_runs, roles, profiles, plus extra columns on cases.
--
-- Run this entire script in Supabase Dashboard → SQL Editor → Run.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE).

-- ─── 1) Extra columns Main writes on cases ─────────────────────────────────
alter table public.cases
  add column if not exists status text default 'published';

alter table public.cases
  add column if not exists confirmation_count int not null default 0;

alter table public.cases
  add column if not exists domain text not null default 'general';

alter table public.cases
  add column if not exists category text not null default 'community';

alter table public.cases
  add column if not exists raw_input text;

alter table public.cases
  add column if not exists source text default 'user';

alter table public.cases
  add column if not exists cta_text text;

alter table public.cases
  add column if not exists submitted_by uuid references auth.users (id);

alter table public.cases
  add column if not exists outcome_url text;

alter table public.cases
  add column if not exists outcome_note text;

alter table public.cases
  add column if not exists mode text default 'community';

alter table public.cases
  add column if not exists created_at timestamptz default now();

-- Backfill status for existing summer rows
update public.cases
set status = 'published'
where status is null;

-- Allow common Main statuses (drop old check if present, then re-add loosely)
do $$
begin
  alter table public.cases drop constraint if exists cases_status_check;
exception when undefined_object then null;
end $$;

alter table public.cases
  add constraint cases_status_check
  check (status in ('pending', 'published', 'archived'));

-- ─── 2) Views so Main store table names resolve ────────────────────────────
-- Main: from("solves") / from("case_pain_votes")
create or replace view public.solves as
select
  id,
  case_id,
  user_id,
  solve_text,
  accepted,
  created_at
from public.case_solves;

create or replace view public.case_pain_votes as
select
  case_id,
  user_id,
  pained_at as created_at
from public.case_pains;

-- Updatable enough for simple inserts via INSTEAD OF triggers
create or replace function public.solves_instead_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.case_solves (case_id, user_id, solve_text, accepted)
  values (new.case_id, new.user_id, new.solve_text, coalesce(new.accepted, false))
  returning id, case_id, user_id, solve_text, accepted, created_at
  into new.id, new.case_id, new.user_id, new.solve_text, new.accepted, new.created_at;
  return new;
end;
$$;

drop trigger if exists solves_instead_insert on public.solves;
create trigger solves_instead_insert
instead of insert on public.solves
for each row execute function public.solves_instead_insert();

create or replace function public.solves_instead_update()
returns trigger
language plpgsql
as $$
begin
  update public.case_solves
  set accepted = new.accepted,
      solve_text = coalesce(new.solve_text, solve_text)
  where id = old.id;
  return new;
end;
$$;

drop trigger if exists solves_instead_update on public.solves;
create trigger solves_instead_update
instead of update on public.solves
for each row execute function public.solves_instead_update();

create or replace function public.case_pain_votes_instead_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.case_pains (case_id, user_id, pained_at)
  values (new.case_id, new.user_id, coalesce(new.created_at, now()))
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists case_pain_votes_instead_insert on public.case_pain_votes;
create trigger case_pain_votes_instead_insert
instead of insert on public.case_pain_votes
for each row execute function public.case_pain_votes_instead_insert();

create or replace function public.case_pain_votes_instead_delete()
returns trigger
language plpgsql
as $$
begin
  delete from public.case_pains
  where case_id = old.case_id and user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists case_pain_votes_instead_delete on public.case_pain_votes;
create trigger case_pain_votes_instead_delete
instead of delete on public.case_pain_votes
for each row execute function public.case_pain_votes_instead_delete();

-- ─── 3) Main-only tables (bigint case_id to match Summer) ──────────────────
create table if not exists public.case_confirmations (
  case_id bigint not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

alter table public.case_confirmations enable row level security;

drop policy if exists "Users can insert own confirmations" on public.case_confirmations;
create policy "Users can insert own confirmations"
  on public.case_confirmations for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Anyone can read confirmations" on public.case_confirmations;
create policy "Anyone can read confirmations"
  on public.case_confirmations for select
  using (true);

create table if not exists public.case_events (
  id bigint generated always as identity primary key,
  case_id bigint not null references public.cases (id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  source text not null default 'user',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_events_case_id_created
  on public.case_events (case_id, created_at desc);

create table if not exists public.scrape_runs (
  id bigint generated always as identity primary key,
  scraped_count int not null default 0,
  promoted_count int not null default 0,
  rejected_count int not null default 0,
  merged_count int not null default 0,
  skipped_count int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.scrape_runs enable row level security;

drop policy if exists "Anyone can read scrape_runs" on public.scrape_runs;
create policy "Anyone can read scrape_runs"
  on public.scrape_runs for select
  using (true);

drop policy if exists "Service role inserts scrape_runs" on public.scrape_runs;
create policy "Service role inserts scrape_runs"
  on public.scrape_runs for insert
  with check (true);

-- ─── 4) Roles + profiles (Main auth profile trigger) ───────────────────────
create table if not exists public.roles (
  id serial primary key,
  name text unique not null
);

insert into public.roles (name) values ('user'), ('guest'), ('prospector'), ('poster')
on conflict (name) do nothing;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  role_id int references public.roles(id),
  created_at timestamptz default now()
);

-- Seed profiles from existing summer users table when possible
insert into public.profiles (id, username, role_id)
select u.id, u.username, (select id from public.roles where name = 'user' limit 1)
from public.users u
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id int;
begin
  select id into default_role_id from public.roles where name = 'user' limit 1;
  insert into public.profiles (id, username, role_id)
  values (new.id, split_part(new.email, '@', 1), default_role_id)
  on conflict (id) do nothing;
  insert into public.users (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 5) Precase extras for Main scrape promote (keep bigint case_id) ───────
alter table public.precase
  add column if not exists ai_status text default 'pending';

alter table public.precase
  add column if not exists rejection_reason text;

alter table public.precase
  add column if not exists processed_at timestamptz;

-- precase.case_id already exists as bigint in Summer — do not change to uuid

create unique index if not exists idx_precase_permalink_unique
  on public.precase (permalink);

-- ─── 6) RLS read policies Main expects for published cases ─────────────────
alter table public.cases enable row level security;

drop policy if exists "Anyone can read cases" on public.cases;
drop policy if exists "Read published cases" on public.cases;
create policy "Read published cases"
  on public.cases for select
  using (status = 'published' or submitted_by = auth.uid() or claimed_by = auth.uid());

-- Service role bypasses RLS for Express backend; anon/authenticated reads via policy.
