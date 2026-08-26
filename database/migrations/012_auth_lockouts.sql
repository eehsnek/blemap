-- Login / forgot-password lockout counters (service role only).

create table if not exists public.auth_lockouts (
  subject_key text primary key,
  fail_count int not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.auth_lockouts enable row level security;
