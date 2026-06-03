-- Auto-create profile row when a user signs up

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id int;
begin
  select id into default_role_id from roles where name = 'user' limit 1;

  insert into public.profiles (id, username, role_id)
  values (
    new.id,
    split_part(new.email, '@', 1),
    default_role_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
