-- MiniLM-L6-v2 embeddings (384-dim) for case similarity / dedupe
create extension if not exists vector with schema extensions;

alter table public.cases
  add column if not exists embedding extensions.vector(384);

comment on column public.cases.embedding is 'all-MiniLM-L6-v2 (384) embedding of topic+summary';

create index if not exists cases_embedding_hnsw
  on public.cases
  using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_cases(
  query_embedding extensions.vector(384),
  match_threshold float default 0.75,
  match_count int default 5,
  filter_status text default null
)
returns table (
  id uuid,
  topic text,
  summary text,
  status text,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.topic,
    c.summary,
    c.status,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.cases c
  where c.embedding is not null
    and (filter_status is null or c.status = filter_status)
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_cases(extensions.vector, float, int, text) to anon, authenticated, service_role;
