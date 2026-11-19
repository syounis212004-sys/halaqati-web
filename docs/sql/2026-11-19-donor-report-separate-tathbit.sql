-- rc49_donor_report: tathbit pages were summed into review_pages. Separate them (same shape as rc40_observer_breakdown).
-- Adds 'tathbit_pages'; 'review_pages' keeps its name (native app + web read it) but now means review_near + review_far only.
-- Rollback: re-run the previous definition, which differs only by `in ('review_near','review_far','tathbit')` and no 'tathbit_pages' key.
create or replace function public.rc49_donor_report(p_month date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare m date := date_trunc('month', p_month)::date; me date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date; r jsonb;
begin
  if not (public.rc32_is_observer() or public.is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'month', m,
    'students', (select count(*) from public.students st where st.status = 'active' and public.rc48_donor_scope_ok(st.halaqa_id)),
    'sessions', (select count(*) from public.sessions s where s.session_date between m and me and s.status <> 'cancelled' and public.rc48_donor_scope_ok(s.halaqa_id)),
    'hifz_pages', coalesce((select sum(re.pages_count) from public.recitation_entries re join public.sessions s on s.id = re.session_id join public.students st on st.id = re.student_id
                    where s.session_date between m and me and s.status <> 'cancelled' and re.activity_type::text = 'new_hifz' and public.rc48_donor_scope_ok(st.halaqa_id)), 0),
    'review_pages', coalesce((select sum(re.pages_count) from public.recitation_entries re join public.sessions s on s.id = re.session_id join public.students st on st.id = re.student_id
                    where s.session_date between m and me and s.status <> 'cancelled' and re.activity_type::text in ('review_near','review_far') and public.rc48_donor_scope_ok(st.halaqa_id)), 0),
    'tathbit_pages', coalesce((select sum(re.pages_count) from public.recitation_entries re join public.sessions s on s.id = re.session_id join public.students st on st.id = re.student_id
                    where s.session_date between m and me and s.status <> 'cancelled' and re.activity_type::text = 'tathbit' and public.rc48_donor_scope_ok(st.halaqa_id)), 0),
    'attendance_pct', (select case when count(*) filter (where ar.status::text in ('present','late','absent')) > 0
                         then round(100.0 * count(*) filter (where ar.status::text in ('present','late')) / count(*) filter (where ar.status::text in ('present','late','absent')), 0) end
                       from public.attendance_records ar join public.sessions s on s.id = ar.session_id
                       where s.session_date between m and me and s.status <> 'cancelled' and public.rc48_donor_scope_ok(s.halaqa_id)),
    'winners', (select count(*) from public.monthly_awards a join public.monthly_award_months am on am.month = a.month and am.status = 'approved'
                where a.month = m and a.scope = 'halaqa' and a.track = 'general_hifz' and a.rank is not null and public.rc48_donor_scope_ok(a.halaqa_id))
  ) into r;
  return r;
end $function$;
