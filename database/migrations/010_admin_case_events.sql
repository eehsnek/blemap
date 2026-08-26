-- Steward repair audit: allow admin source + edit/merge event types.
-- Safe on both constrained (005) and unconstrained (006) case_events tables.

alter table public.case_events drop constraint if exists case_events_event_type_check;
alter table public.case_events
  add constraint case_events_event_type_check
  check (event_type in (
    'submitted', 'confirmed', 'published',
    'pain_added', 'pain_removed',
    'claimed', 'unclaimed',
    'solve_added', 'solve_accepted', 'solve_unaccepted',
    'marked_solved', 'merged_signal', 'merged_case',
    'status_changed', 'admin_edited'
  ));

alter table public.case_events drop constraint if exists case_events_source_check;
alter table public.case_events
  add constraint case_events_source_check
  check (source in ('user', 'scrape', 'system', 'admin'));
