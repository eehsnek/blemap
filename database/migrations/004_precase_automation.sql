-- Precase automation queue + scrape run logging

alter table precase add column if not exists ai_status text not null default 'pending'
  check (ai_status in ('pending', 'analyzed', 'promoted', 'rejected', 'duplicate'));

alter table precase add column if not exists rejection_reason text;
alter table precase add column if not exists processed_at timestamptz;
alter table precase add column if not exists case_id uuid references cases (id) on delete set null;

create unique index if not exists idx_precase_permalink_unique on precase (permalink);

create table if not exists scrape_runs (
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

alter table scrape_runs enable row level security;

create policy "Anyone can read scrape_runs"
  on scrape_runs for select
  using (true);

create policy "Service role inserts scrape_runs"
  on scrape_runs for insert
  with check (true);
