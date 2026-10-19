-- Halaqati v2.15.0 — in-app notifications, device tokens and guardian notification preferences.
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'android',
  push_token text not null unique,
  device_name text,
  app_version text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_devices_user_active_idx on public.user_devices(user_id,active);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  attendance boolean not null default true,
  recitation boolean not null default true,
  behavior boolean not null default true,
  announcements boolean not null default true,
  achievements boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  halaqa_id uuid references public.halaqas(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  kind text not null default 'system',
  title text not null,
  body text not null,
  source_key text not null,
  deep_link text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_status text not null default 'pending',
  push_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recipient_id,source_key)
);
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id,created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id,read_at) where read_at is null;
create index if not exists notifications_sender_created_idx on public.notifications(sender_id,created_at desc);

alter table public.user_devices enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

drop policy if exists user_devices_select_own on public.user_devices;
create policy user_devices_select_own on public.user_devices for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists user_devices_insert_own on public.user_devices;
create policy user_devices_insert_own on public.user_devices for insert to authenticated with check (user_id=auth.uid());
drop policy if exists user_devices_update_own on public.user_devices;
create policy user_devices_update_own on public.user_devices for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists user_devices_delete_own on public.user_devices;
create policy user_devices_delete_own on public.user_devices for delete to authenticated using (user_id=auth.uid() or public.is_admin());

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated with check (user_id=auth.uid());
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists notifications_select_access on public.notifications;
create policy notifications_select_access on public.notifications for select to authenticated using (
  recipient_id=auth.uid()
  or public.is_admin()
  or (sender_id=auth.uid() and public."current_role"() in ('admin'::public.app_role,'supervisor'::public.app_role))
);
drop policy if exists notifications_update_read_own on public.notifications;
create policy notifications_update_read_own on public.notifications for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());

create or replace function public.touch_notification_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists user_devices_touch_updated_at on public.user_devices;
create trigger user_devices_touch_updated_at before update on public.user_devices for each row execute function public.touch_notification_updated_at();
drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at before update on public.notification_preferences for each row execute function public.touch_notification_updated_at();
drop trigger if exists notifications_touch_updated_at on public.notifications;
create trigger notifications_touch_updated_at before update on public.notifications for each row execute function public.touch_notification_updated_at();
