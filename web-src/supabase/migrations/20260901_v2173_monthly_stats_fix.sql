-- Halaqati v2.17.3
-- Fix monthly_student_stats:
-- 1) Count recitations even when no attendance row exists for the same student/month.
-- 2) Treat sessions.session_date as a DATE/local calendar value (no timestamptz/UTC month shift).
-- 3) Preserve security_invoker so existing RLS/access rules continue to apply.

begin;

create or replace view public.monthly_student_stats
with (security_invoker = true)
as
with attendance as (
    select
        ar.student_id,
        date_trunc('month', se.session_date::timestamp)::date as month_start,
        count(*) filter (where ar.status = 'present'::attendance_status) as present_days,
        count(*) filter (where ar.status = 'absent'::attendance_status) as absent_days,
        count(*) filter (where ar.status = 'excused'::attendance_status) as excused_days,
        count(*) filter (where ar.status = 'late'::attendance_status) as late_days
    from public.attendance_records ar
    join public.sessions se
      on se.id = ar.session_id
    group by
        ar.student_id,
        date_trunc('month', se.session_date::timestamp)::date
),
rec as (
    select
        re.student_id,
        date_trunc('month', se.session_date::timestamp)::date as month_start,
        coalesce(
            sum(re.pages_count) filter (
                where re.activity_type = 'new_hifz'::activity_type
            ),
            0::numeric
        )::numeric(8,2) as hifz_pages,
        coalesce(
            sum(re.pages_count) filter (
                where re.activity_type = any (
                    array[
                        'review_near'::activity_type,
                        'review_far'::activity_type
                    ]
                )
            ),
            0::numeric
        )::numeric(8,2) as review_pages,
        coalesce(
            sum(re.pages_count) filter (
                where re.activity_type = 'sard'::activity_type
            ),
            0::numeric
        )::numeric(8,2) as sard_pages,
        coalesce(sum(re.ayahs_count), 0::bigint)::integer as ayahs_count,
        coalesce(sum(re.mistakes), 0::bigint)::integer as mistakes,
        round(avg(re.score), 2) as avg_score
    from public.recitation_entries re
    join public.sessions se
      on se.id = re.session_id
    group by
        re.student_id,
        date_trunc('month', se.session_date::timestamp)::date
),
months as (
    select student_id, month_start from attendance
    union
    select student_id, month_start from rec
)
select
    s.id as student_id,
    s.full_name,
    m.month_start,
    coalesce(r.hifz_pages, 0::numeric) as hifz_pages,
    coalesce(r.review_pages, 0::numeric) as review_pages,
    coalesce(r.sard_pages, 0::numeric) as sard_pages,
    coalesce(r.ayahs_count, 0) as ayahs_count,
    coalesce(r.mistakes, 0) as mistakes,
    r.avg_score,
    coalesce(a.present_days, 0::bigint)::integer as present_days,
    coalesce(a.absent_days, 0::bigint)::integer as absent_days,
    coalesce(a.excused_days, 0::bigint)::integer as excused_days,
    coalesce(a.late_days, 0::bigint)::integer as late_days
from months m
join public.students s
  on s.id = m.student_id
left join attendance a
  on a.student_id = m.student_id
 and a.month_start = m.month_start
left join rec r
  on r.student_id = m.student_id
 and r.month_start = m.month_start
where public.can_access_student(s.id);

commit;

-- Optional verification after running:
-- select month_start,
--        sum(hifz_pages) as hifz_pages,
--        sum(review_pages) as review_pages,
--        sum(sard_pages) as sard_pages
-- from public.monthly_student_stats
-- where month_start in (date '2026-08-01', date '2026-09-01')
-- group by month_start
-- order by month_start;
