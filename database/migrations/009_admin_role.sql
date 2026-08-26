-- Admin role for moderation (SR-13).
-- Stewards can also promote via Archive Steward → Users.
-- Bootstrap SQL:
--   update profiles
--   set role_id = (select id from roles where name = 'admin')
--   where id = '<auth.users.id>';

insert into public.roles (name) values ('admin')
on conflict (name) do nothing;
