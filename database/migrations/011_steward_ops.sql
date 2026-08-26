-- Steward ops: case flags + profile disable for user management.

alter table public.cases
  add column if not exists flagged boolean not null default false;

alter table public.cases
  add column if not exists flag_reason text;

alter table public.cases
  add column if not exists flagged_at timestamptz;

alter table public.cases
  add column if not exists flagged_by uuid references auth.users (id) on delete set null;

create index if not exists idx_cases_flagged
  on public.cases (flagged)
  where flagged = true;

alter table public.profiles
  add column if not exists disabled boolean not null default false;

alter table public.case_events drop constraint if exists case_events_event_type_check;
alter table public.case_events
  add constraint case_events_event_type_check
  check (event_type in (
    'submitted', 'confirmed', 'published',
    'pain_added', 'pain_removed',
    'claimed', 'unclaimed',
    'solve_added', 'solve_accepted', 'solve_unaccepted',
    'marked_solved', 'merged_signal', 'merged_case',
    'status_changed', 'admin_edited',
    'flagged', 'unflagged', 'role_changed'
  ));
