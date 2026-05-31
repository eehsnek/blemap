-- Enable RLS
alter table cases enable row level security;

-- Allow guests to read
create policy "Guests can read cases"
on cases for select
using (exists (
  select 1 from profiles p
  where p.id = auth.uid()
  and p.role_id = (select id from roles where name = 'guest')
));

-- Allow users to insert
create policy "Users can insert cases"
on cases for insert
with check (exists (
  select 1 from profiles p
  where p.id = auth.uid()
  and p.role_id = (select id from roles where name = 'user')
));
