create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  role_id int references roles(id),
  created_at timestamp default now()
);
