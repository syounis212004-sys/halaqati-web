-- Halaqati 2.91.0 — scale hardening for 10,000+ students. Additive, idempotent, no policy meaning changes.
-- NOT applied automatically. Review, then run once in the Supabase SQL Editor (a quiet hour: ALTER POLICY takes a brief lock).
-- Evidence (read-only checks on the live project, 2026-11-16): the performance advisor reports 6 auth_rls_initplan warnings,
-- 64 unindexed foreign keys; students_select calls is_admin() once per row; recitation_select/sessions_select call
-- can_access_student()/can_access_halaqa() once per row even for admins.
--
-- 1) Wrap argument-free, row-independent helpers (auth.uid(), is_admin(), is_platform_owner(), my_association()) in (select …)
--    so Postgres evaluates them once per statement (initPlan) instead of once per row. Per policy, a failure is skipped (notice).
do $$
declare
  r record;
  q text; w text; stmt text; changed int := 0;
  wrap constant text := '(?<!select )(?<![\w."])((public\.)?(is_admin|is_platform_owner|my_association)\(\))';
  wrap_auth constant text := '(?<!select )(?<![\w.])(auth\.(uid|jwt|role)\(\))';
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := case when r.qual is null then null
              else regexp_replace(regexp_replace(r.qual, wrap, '(select \1)', 'gi'), wrap_auth, '(select \1)', 'gi') end;
    w := case when r.with_check is null then null
              else regexp_replace(regexp_replace(r.with_check, wrap, '(select \1)', 'gi'), wrap_auth, '(select \1)', 'gi') end;
    if q is distinct from r.qual or w is distinct from r.with_check then
      stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
      if w is not null then stmt := stmt || ' with check (' || w || ')'; end if;
      begin
        execute stmt;
        changed := changed + 1;
      exception when others then
        raise notice 'skipped %.%: %', r.tablename, r.policyname, sqlerrm;
      end;
    end if;
  end loop;
  raise notice 'scale hardening: % policies updated', changed;
end $$;

-- 2) Admin short-circuit on the two hottest read paths. can_access_halaqa()/can_access_student() already return true for
--    admins, so access is identical; the planner now skips the per-row function call when the caller is an admin.
alter policy sessions_select on public.sessions
  using ((select public.is_admin()) or public.can_access_halaqa(halaqa_id));
alter policy recitation_select on public.recitation_entries
  using ((select public.is_admin()) or public.can_access_student(student_id));

-- 3) Indexes for foreign keys on tables that grow with students (cascades, deletes and joins scan these otherwise).
create index if not exists student_points_student_id_idx        on public.student_points(student_id);
create index if not exists monthly_awards_student_id_idx        on public.monthly_awards(student_id);
create index if not exists monthly_awards_halaqa_id_idx         on public.monthly_awards(halaqa_id);
create index if not exists monthly_award_exclusions_student_idx on public.monthly_award_exclusions(student_id);
create index if not exists forum_comments_post_id_idx           on public.forum_comments(post_id);
create index if not exists forum_posts_halaqa_id_idx            on public.forum_posts(halaqa_id);
create index if not exists announcements_halaqa_id_idx          on public.announcements(halaqa_id);
create index if not exists sessions_created_by_idx              on public.sessions(created_by);
create index if not exists recitation_entries_created_by_idx    on public.recitation_entries(created_by);
create index if not exists attendance_records_recorded_by_idx   on public.attendance_records(recorded_by);
create index if not exists students_primary_teacher_id_idx      on public.students(primary_teacher_id);
create index if not exists support_pledges_donor_id_idx         on public.support_pledges(donor_id);
create index if not exists donor_threads_donor_id_idx           on public.donor_threads(donor_id);
create index if not exists guardian_link_requests_student_idx   on public.guardian_link_requests(student_id);
create index if not exists supervisor_visits_halaqa_id_idx      on public.supervisor_visits(halaqa_id);
create index if not exists supervisor_visits_supervisor_id_idx  on public.supervisor_visits(supervisor_id);

-- Check afterwards (should return 0 rows for the auth_rls_initplan lint): Dashboard → Advisors → Performance.
