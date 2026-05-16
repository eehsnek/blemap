-- Create precase table
create table precase (
  id bigint generated always as identity primary key,
  title text not null,
  permalink text not null,
  subreddit text,
  created_at timestamp default now()
);

-- Helpful index for faster lookups by subreddit
create index idx_precase_subreddit on precase(subreddit);

-- Enable Row Level Security
alter table precase enable row level security;

-- Policy: allow authenticated users to read
create policy "Authenticated users can read precase"
on precase for select
to authenticated
using (true);

-- Policy: allow authenticated users to insert their own rows
create policy "Authenticated users can insert precase"
on precase for insert
to authenticated
with check (true);

-- Future enhancement: track AI processing status
-- alter table precase add column ai_status text default 'pending';
