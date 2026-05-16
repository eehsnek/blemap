create table cases (
  id bigint generated always as identity primary key,
  topic text,
  summary text,
  permalinks text[],
  subreddits text[],
  ai_status text,
  aggregated_at timestamptz default now()
);