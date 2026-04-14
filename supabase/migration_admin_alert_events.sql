-- In-app realtime for admins (Supabase Realtime postgres_changes). Run in SQL Editor.
-- Also: Dashboard → Database → Replication → enable for `admin_alert_events` if inserts do not stream.

create table if not exists public.admin_alert_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (
    kind in ('order_new', 'order_edit', 'design_change', 'deletion')
  ),
  title text not null,
  body text not null default '',
  nav text
);

create index if not exists idx_admin_alert_events_created_at on public.admin_alert_events (created_at desc);

comment on table public.admin_alert_events is 'Ephemeral rows for admin in-app alerts (Realtime); server inserts only.';

alter table public.admin_alert_events enable row level security;

drop policy if exists "admins_read_admin_alert_events" on public.admin_alert_events;

create policy "admins_read_admin_alert_events"
on public.admin_alert_events
for select
to authenticated
using (
  exists (
    select 1
    from public.app_users u
    where u.auth_user_id = auth.uid()
      and u.role = 'admin'
      and u.active = true
  )
);

grant select on public.admin_alert_events to authenticated;

-- Realtime: add table to publication (Supabase hosted).
alter publication supabase_realtime add table public.admin_alert_events;
