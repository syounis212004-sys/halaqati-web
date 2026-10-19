-- Halaqati v2.17.1
-- Category smart plans + safe permanent account deletion.
begin;

alter table public.smart_plans
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.smart_plans'::regclass
      and conname='smart_plans_category_id_fkey'
  ) then
    alter table public.smart_plans
      add constraint smart_plans_category_id_fkey
      foreign key (category_id) references public.student_categories(id) on delete cascade;
  end if;
end $$;

alter table public.smart_plans drop constraint if exists smart_plans_scope_type_check;
alter table public.smart_plans
  add constraint smart_plans_scope_type_check
  check (scope_type in ('student','category','halaqa'));

alter table public.smart_plans drop constraint if exists smart_plans_check1;
alter table public.smart_plans drop constraint if exists smart_plans_scope_target_check;
alter table public.smart_plans
  add constraint smart_plans_scope_target_check
  check (
    (scope_type='student' and student_id is not null and category_id is null)
    or (scope_type='category' and student_id is null and category_id is not null)
    or (scope_type='halaqa' and student_id is null and category_id is null)
  );

create index if not exists smart_plans_category_active_range_idx
  on public.smart_plans(category_id,start_date,end_date,plan_type)
  where status='active' and category_id is not null;

-- Guardians may read a category plan only when their linked child belongs to it.
drop policy if exists smart_plans_select_access on public.smart_plans;
create policy smart_plans_select_access
on public.smart_plans
for select
to authenticated
using (
  public.is_admin()
  or created_by=(select auth.uid())
  or exists (
    select 1 from public.halaqa_teachers ht
    where ht.halaqa_id=smart_plans.halaqa_id
      and ht.teacher_id=(select auth.uid())
  )
  or exists (
    select 1 from public.halaqa_supervisors hs
    where hs.halaqa_id=smart_plans.halaqa_id
      and hs.supervisor_id=(select auth.uid())
  )
  or exists (
    select 1
    from public.students s
    join public.student_guardians sg on sg.student_id=s.id
    where sg.guardian_id=(select auth.uid())
      and s.halaqa_id=smart_plans.halaqa_id
      and (
        (smart_plans.scope_type='halaqa')
        or (smart_plans.scope_type='category' and smart_plans.category_id=s.category_id)
        or (smart_plans.scope_type='student' and smart_plans.student_id=s.id)
      )
  )
);

-- Deletes the actual Supabase Auth account.  The caller must be the system admin.
-- Historical recitation/session rows already use ON DELETE SET NULL for their creator.
-- Smart plans/events use RESTRICT, so their ownership is transferred to the deleting admin.
create or replace function public.admin_delete_account(target_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  target_role public.app_role;
begin
  if actor is null or not public.is_admin() then
    raise exception 'Only the system administrator can permanently delete accounts';
  end if;
  if target_user is null then
    raise exception 'Target account is required';
  end if;
  if target_user=actor then
    raise exception 'The system administrator cannot delete their own account';
  end if;

  select role into target_role from public.profiles where id=target_user;
  if not found then
    return false;
  end if;
  if target_role='admin'::public.app_role then
    raise exception 'An administrator account cannot be deleted from the app';
  end if;

  update public.smart_plans set created_by=actor where created_by=target_user;
  update public.smart_plan_events set created_by=actor where created_by=target_user;
  update public.student_categories set created_by=null where created_by=target_user;
  update public.students set withdrawn_by=null where withdrawn_by=target_user;

  -- auth.users -> public.profiles is ON DELETE CASCADE.  Membership/device/notification
  -- rows tied to the account are removed by their existing FK rules.
  delete from auth.users where id=target_user;
  return found;
end;
$$;

revoke all on function public.admin_delete_account(uuid) from public;
revoke all on function public.admin_delete_account(uuid) from anon;
grant execute on function public.admin_delete_account(uuid) to authenticated;

commit;
