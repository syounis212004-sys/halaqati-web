-- Halaqati v2.19.0 Operations Suite
-- Safe additive migration: audit trail, two-track enforcement, and sanity protection.

begin;

-- The application now has exactly two program tracks. Legacy sard students belong to general hifz.
update public.students
set track_code='general_hifz', updated_at=now()
where track_code='sard';

alter table public.students drop constraint if exists students_track_code_check;
alter table public.students
  add constraint students_track_code_check
  check (track_code is null or track_code in ('general_hifz','tathbit'));

-- Protect new recitation writes from clearly impossible accidental values without breaking historic rows.
alter table public.recitation_entries drop constraint if exists recitation_entries_reasonable_pages_check;
alter table public.recitation_entries
  add constraint recitation_entries_reasonable_pages_check
  check (pages_count <= 80) not valid;

-- Cross-device duplicate protection: the same recitation signature cannot be inserted twice.
-- PostgreSQL 17 supports NULLS NOT DISTINCT, so optional range fields are compared safely.
create unique index if not exists recitation_entries_no_exact_duplicate_idx
  on public.recitation_entries
  (session_id, student_id, activity_type, start_surah, start_ayah, end_surah, end_ayah, start_page, end_page, pages_count)
  nulls not distinct;

-- Append-only audit trail. The client remains offline-first; rows are synced whenever online.
create table if not exists public.halaqati_audit_log (
  id uuid primary key default gen_random_uuid(),
  halaqa_id uuid references public.halaqas(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists halaqati_audit_log_halaqa_created_idx
  on public.halaqati_audit_log(halaqa_id, created_at desc);
create index if not exists halaqati_audit_log_actor_created_idx
  on public.halaqati_audit_log(actor_id, created_at desc);

alter table public.halaqati_audit_log enable row level security;

revoke all on table public.halaqati_audit_log from anon;
revoke all on table public.halaqati_audit_log from authenticated;
grant select, insert on table public.halaqati_audit_log to authenticated;

drop policy if exists halaqati_audit_log_select on public.halaqati_audit_log;
create policy halaqati_audit_log_select
on public.halaqati_audit_log
for select
to authenticated
using (
  actor_id = (select auth.uid())
  or (select public.is_admin())
  or (
    halaqa_id is not null
    and exists (
      select 1 from public.halaqa_teachers ht
      where ht.halaqa_id = halaqati_audit_log.halaqa_id
        and ht.teacher_id = (select auth.uid())
    )
  )
  or (
    halaqa_id is not null
    and exists (
      select 1 from public.halaqa_supervisors hs
      where hs.halaqa_id = halaqati_audit_log.halaqa_id
        and hs.supervisor_id = (select auth.uid())
    )
  )
);

drop policy if exists halaqati_audit_log_insert on public.halaqati_audit_log;
create policy halaqati_audit_log_insert
on public.halaqati_audit_log
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (select public."current_role"()) in (
    'admin'::public.app_role,
    'supervisor'::public.app_role,
    'teacher'::public.app_role
  )
);

comment on table public.halaqati_audit_log is
  'Append-only Halaqati v2.19 operations audit trail. No authenticated UPDATE/DELETE grants.';

commit;
