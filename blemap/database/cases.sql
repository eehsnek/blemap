create table cases (
  id bigint generated always as identity primary key,
  topic text,
  summary text,
  permalinks text[],
  subreddits text[],
  ai_status text,
  aggregated_at timestamptz default now()

  -- Lifecycle state: grey, orange, green
  lifecycle_state text check (lifecycle_state in ('grey','orange','green')) default 'grey',

  -- Claiming user (orange state)
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,

  -- Resolution (green state)
  resolved boolean default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),

  -- Interaction counters
  claim_count integer default 0,
  pain_count integer default 0,
  solve_count integer default 0
);

-- Helpful indexes for faster lookups
create index idx_cases_mode on cases(mode);
create index idx_cases_topic on cases(topic);