-- Persist analyze drafts across server restarts (fault tree 2).
-- Steward user-role audit (fault tree 3).

create table if not exists public.submit_drafts (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete set null,
  raw_input text not null,
  analysis jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_submit_drafts_expires
  on public.submit_drafts (expires_at);

alter table public.submit_drafts enable row level security;

create table if not exists public.steward_audit (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  target_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_steward_audit_created
  on public.steward_audit (created_at desc);

alter table public.steward_audit enable row level security;
