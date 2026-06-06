create table if not exists case_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references cases (id) on delete cascade,
  event_type text not null check (event_type in (
    'submitted', 'confirmed', 'published',
    'pain_added', 'pain_removed',
    'claimed', 'unclaimed',
    'solve_added', 'solve_accepted', 'solve_unaccepted',
    'marked_solved', 'merged_signal', 'status_changed'
  )),
  actor_id uuid references auth.users (id) on delete set null,
  source text not null default 'user' check (source in ('user', 'scrape', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_events_case_id_created
  on case_events (case_id, created_at desc);

create index if not exists idx_case_events_type_created
  on case_events (event_type, created_at desc);
