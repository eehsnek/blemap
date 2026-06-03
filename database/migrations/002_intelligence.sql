-- BleMap Iteration 2: intelligence, validation, prospector fields

alter table cases add column if not exists status text not null default 'published'
  check (status in ('pending', 'published', 'archived'));

alter table cases add column if not exists confirmation_count int not null default 5;
alter table cases add column if not exists domain text not null default 'general';
alter table cases add column if not exists category text not null default 'community';
alter table cases add column if not exists raw_input text;
alter table cases add column if not exists source text default 'user';
alter table cases add column if not exists cta_text text;
alter table cases add column if not exists submitted_by uuid references auth.users (id);
alter table cases add column if not exists outcome_url text;
alter table cases add column if not exists outcome_note text;

create table if not exists case_confirmations (
  case_id uuid not null references cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

alter table case_confirmations enable row level security;

create policy "Users can insert own confirmations"
  on case_confirmations for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Anyone can read confirmations"
  on case_confirmations for select
  using (true);

-- Roles extension
insert into roles (name) values ('prospector'), ('poster')
on conflict (name) do nothing;

-- Published cases visible on matrix
drop policy if exists "Anyone can read cases" on cases;
create policy "Read published cases"
  on cases for select
  using (status = 'published' or submitted_by = auth.uid());

create policy "Authenticated insert cases"
  on cases for insert
  to authenticated
  with check (true);

create policy "Users update own pending"
  on cases for update
  to authenticated
  using (submitted_by = auth.uid() or claimed_by = auth.uid());
