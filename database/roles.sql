create table roles (
  id serial primary key,
  name text unique not null
);

insert into roles (name) values
  ('user'),
  ('guest');
