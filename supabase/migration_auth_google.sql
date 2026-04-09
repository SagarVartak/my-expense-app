-- Links app_users to Supabase Auth (Google OAuth). Run in SQL Editor after enabling Google provider.
alter table public.app_users add column if not exists auth_user_id uuid unique;

comment on column public.app_users.auth_user_id is 'Supabase auth.users.id when the member signs in with Google; null for password-only admin.';

-- Optional: enforce FK to auth.users (requires sufficient privilege)
-- alter table public.app_users
--   add constraint app_users_auth_user_id_fkey foreign key (auth_user_id) references auth.users (id) on delete set null;
