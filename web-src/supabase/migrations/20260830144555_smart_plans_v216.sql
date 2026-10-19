-- Halaqati v2.16.1 — event-driven smart memorisation and revision plans.
-- Progress is intentionally derived from recitation_entries; no mutable aggregate
-- counters are stored here, which keeps offline merges deterministic.

create or replace function public.halaqati_smallint_array_between(
  items smallint[], minimum smallint, maximum smallint
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = pg_catalog
as $$
  select coalesce(bool_and(item between minimum and maximum), true)
  from unnest(items) as item;
$$;

create table if not exists public.smart_plans (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'student'
    check (scope_type in ('student','halaqa')),
  halaqa_id uuid not null references public.halaqas(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  parent_plan_id uuid references public.smart_plans(id) on delete set null,
  plan_type text not null default 'hifz'
    check (plan_type in ('hifz','review','sard','tathbit')),
  review_tier text not null default 'none'
    check (review_tier in ('none','near','far','both')),
  title text not null,
  goal_unit text not null default 'pages'
    check (goal_unit in ('pages','juz','surah','rub','ayahs')),
  target_units numeric(10,2) not null check (target_units > 0),
  target_pages numeric(10,2) not null check (target_pages > 0),
  start_date date not null,
  end_date date not null,
  schedule_weekdays smallint[] not null default array[0,1,2,3,4]::smallint[],
  catch_up_weekday smallint,
  max_daily_multiplier numeric(4,2) not null default 1.50
    check (max_daily_multiplier between 1 and 3),
  auto_extend boolean not null default true,
  quality_gate_enabled boolean not null default true,
  minimum_evaluation text not null default 'very_good'
    check (minimum_evaluation in ('excellent','very_good','good','repeat')),
  range_start_page smallint check (range_start_page between 1 and 604),
  range_end_page smallint check (range_end_page between 1 and 604),
  range_start_surah smallint check (range_start_surah between 1 and 114),
  range_start_ayah smallint check (range_start_ayah > 0),
  range_end_surah smallint check (range_end_surah between 1 and 114),
  range_end_ayah smallint check (range_end_ayah > 0),
  selected_surahs smallint[] not null default '{}'::smallint[],
  selected_juz smallint[] not null default '{}'::smallint[],
  selected_rubs smallint[] not null default '{}'::smallint[],
  near_revision_pages numeric(6,2) not null default 7
    check (near_revision_pages between 0 and 30),
  far_revision_pages numeric(6,2) not null default 20
    check (far_revision_pages between 0 and 604),
  milestone_mode text not null default 'juz'
    check (milestone_mode in ('none','hizb','juz')),
  milestone_requires_approval boolean not null default true,
  delay_alert_days smallint not null default 3
    check (delay_alert_days between 1 and 30),
  home_prep_push boolean not null default true,
  status text not null default 'active'
    check (status in ('draft','active','paused','completed','archived')),
  note text,
  settings jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (cardinality(schedule_weekdays) > 0),
  check (schedule_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  check (catch_up_weekday is null or catch_up_weekday between 0 and 6),
  check (
    (scope_type = 'student' and student_id is not null)
    or (scope_type = 'halaqa' and student_id is null)
  ),
  check (
    (range_start_page is null and range_end_page is null)
    or (range_start_page is not null and range_end_page is not null and range_end_page >= range_start_page)
  ),
  check (public.halaqati_smallint_array_between(selected_surahs,1::smallint,114::smallint)),
  check (public.halaqati_smallint_array_between(selected_juz,1::smallint,30::smallint)),
  check (public.halaqati_smallint_array_between(selected_rubs,1::smallint,240::smallint))
);

comment on table public.smart_plans is
  'Plan definitions only. Completion and health are derived from recitation_entries and sessions.';

create table if not exists public.smart_plan_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null unique,
  plan_id uuid not null references public.smart_plans(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null check (event_type in (
    'milestone_approved','auto_extension','manual_credit','manual_debit',
    'pause','resume','notification_sent','retry_required','catch_up'
  )),
  event_date date not null default current_date,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.smart_plan_events is
  'Append-only decisions and sync-safe plan events; recitation facts remain in recitation_entries.';

create index if not exists smart_plans_halaqa_idx
  on public.smart_plans(halaqa_id);
create index if not exists smart_plans_student_idx
  on public.smart_plans(student_id) where student_id is not null;
create index if not exists smart_plans_parent_idx
  on public.smart_plans(parent_plan_id) where parent_plan_id is not null;
create index if not exists smart_plans_creator_idx
  on public.smart_plans(created_by);
create index if not exists smart_plans_student_active_range_idx
  on public.smart_plans(student_id,start_date,end_date,plan_type)
  where status = 'active' and student_id is not null;
create index if not exists smart_plans_halaqa_active_type_idx
  on public.smart_plans(halaqa_id,plan_type,start_date,end_date)
  where status = 'active';
create index if not exists smart_plan_events_plan_date_idx
  on public.smart_plan_events(plan_id,event_date desc);
create index if not exists smart_plan_events_student_date_idx
  on public.smart_plan_events(student_id,event_date desc);
create index if not exists smart_plan_events_creator_idx
  on public.smart_plan_events(created_by);
create index if not exists smart_plan_events_milestone_idx
  on public.smart_plan_events(plan_id,student_id,event_type,event_date desc)
  where event_type = 'milestone_approved';

alter table public.smart_plans enable row level security;
alter table public.smart_plan_events enable row level security;

revoke all on table public.smart_plans from anon;
revoke all on table public.smart_plan_events from anon;
revoke all on table public.smart_plans from authenticated;
revoke all on table public.smart_plan_events from authenticated;
grant select, insert, update, delete on table public.smart_plans to authenticated;
grant select, insert on table public.smart_plan_events to authenticated;
revoke all on function public.halaqati_smallint_array_between(smallint[],smallint,smallint) from public, anon;
grant execute on function public.halaqati_smallint_array_between(smallint[],smallint,smallint) to authenticated;

drop policy if exists smart_plans_select_access on public.smart_plans;
create policy smart_plans_select_access
on public.smart_plans for select to authenticated
using (
  public.is_admin()
  or created_by = (select auth.uid())
  or exists (
    select 1 from public.halaqa_teachers ht
    where ht.halaqa_id = smart_plans.halaqa_id
      and ht.teacher_id = (select auth.uid())
  )
  or exists (
    select 1 from public.halaqa_supervisors hs
    where hs.halaqa_id = smart_plans.halaqa_id
      and hs.supervisor_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.students s
    join public.student_guardians sg on sg.student_id = s.id
    where sg.guardian_id = (select auth.uid())
      and s.halaqa_id = smart_plans.halaqa_id
      and (smart_plans.student_id is null or smart_plans.student_id = s.id)
  )
);

drop policy if exists smart_plans_insert_manage on public.smart_plans;
create policy smart_plans_insert_manage
on public.smart_plans for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.is_admin()
    or exists (
    select 1 from public.halaqa_teachers ht
    where ht.halaqa_id = smart_plans.halaqa_id
      and ht.teacher_id = (select auth.uid())
    )
    or exists (
    select 1 from public.halaqa_supervisors hs
    where hs.halaqa_id = smart_plans.halaqa_id
      and hs.supervisor_id = (select auth.uid())
    )
  )
);

drop policy if exists smart_plans_update_manage on public.smart_plans;
create policy smart_plans_update_manage
on public.smart_plans for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.halaqa_teachers ht
    where ht.halaqa_id = smart_plans.halaqa_id
      and ht.teacher_id = (select auth.uid())
  )
  or exists (
    select 1 from public.halaqa_supervisors hs
    where hs.halaqa_id = smart_plans.halaqa_id
      and hs.supervisor_id = (select auth.uid())
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.halaqa_teachers ht
    where ht.halaqa_id = smart_plans.halaqa_id
      and ht.teacher_id = (select auth.uid())
  )
  or exists (
    select 1 from public.halaqa_supervisors hs
    where hs.halaqa_id = smart_plans.halaqa_id
      and hs.supervisor_id = (select auth.uid())
  )
);

drop policy if exists smart_plans_delete_manage on public.smart_plans;
create policy smart_plans_delete_manage
on public.smart_plans for delete to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.halaqa_teachers ht
    where ht.halaqa_id = smart_plans.halaqa_id
      and ht.teacher_id = (select auth.uid())
  )
  or exists (
    select 1 from public.halaqa_supervisors hs
    where hs.halaqa_id = smart_plans.halaqa_id
      and hs.supervisor_id = (select auth.uid())
  )
);

drop policy if exists smart_plan_events_select_access on public.smart_plan_events;
create policy smart_plan_events_select_access
on public.smart_plan_events for select to authenticated
using (
  exists (
    select 1 from public.smart_plans sp
    where sp.id = smart_plan_events.plan_id
  )
);

drop policy if exists smart_plan_events_insert_manage on public.smart_plan_events;
create policy smart_plan_events_insert_manage
on public.smart_plan_events for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.smart_plans sp
    join public.students s
      on s.id = smart_plan_events.student_id
     and s.halaqa_id = sp.halaqa_id
    where sp.id = smart_plan_events.plan_id
      and (sp.student_id is null or sp.student_id = smart_plan_events.student_id)
      and (
        public.is_admin()
        or exists (
          select 1 from public.halaqa_teachers ht
          where ht.halaqa_id = sp.halaqa_id
            and ht.teacher_id = (select auth.uid())
        )
        or exists (
          select 1 from public.halaqa_supervisors hs
          where hs.halaqa_id = sp.halaqa_id
            and hs.supervisor_id = (select auth.uid())
        )
      )
  )
);

drop trigger if exists smart_plans_set_updated_at on public.smart_plans;
create or replace function public.smart_plan_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger smart_plans_set_updated_at
before update on public.smart_plans
for each row execute function public.smart_plan_set_updated_at();
