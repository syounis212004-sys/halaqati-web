-- Halaqati v2.42.0 — guardian rank context + daily series
-- Ranking stays points-first and is calculated against the student's own program track.
-- Guardian receives only his/her child's aggregate/rank context; peer identities are not returned.

create or replace function public.guardian_student_dashboard_range(
  p_student_id uuid,
  p_from date default current_date,
  p_to date default current_date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_halaqa uuid;
  v_category uuid;
  v_track text;
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range';
  end if;

  if not public.can_access_student(p_student_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  select s.halaqa_id, s.category_id, s.track_code
    into v_halaqa, v_category, v_track
  from public.students s
  where s.id=p_student_id and s.status='active';

  if v_halaqa is null then
    return jsonb_build_object('daily','[]'::jsonb,'ranks','{}'::jsonb,'attendance','{}'::jsonb);
  end if;

  with tracks(track) as (
    values ('hifz'::text),('review'::text),('sard'::text)
  ), cohort as (
    select s.id, s.category_id
    from public.students s
    where s.status='active'
      and s.halaqa_id=v_halaqa
      and s.track_code is not distinct from v_track
  ), metrics as (
    select c.id as student_id, c.category_id, t.track,
      coalesce(sum(case
        when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.points
        when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.points
        when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.points
        else 0 end),0)::numeric as points,
      coalesce(sum(case
        when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.pages_count
        when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.pages_count
        when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.pages_count
        else 0 end),0)::numeric as pages,
      coalesce(sum(case
        when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.penalty_units
        when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.penalty_units
        when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.penalty_units
        else 0 end),0)::numeric as penalty_units
    from cohort c
    cross join tracks t
    left join public.recitation_entries r on r.student_id=c.id
    left join public.sessions se on se.id=r.session_id
      and se.status <> 'cancelled'
      and se.session_date between p_from and p_to
    group by c.id,c.category_id,t.track
  ), ranked as (
    select m.*,
      case when m.pages>0 then rank() over(partition by m.track order by m.points desc,m.pages desc,(m.penalty_units/nullif(m.pages,0)) asc nulls last,m.student_id) end as halaqa_rank,
      count(*) over(partition by m.track) as halaqa_total,
      case when m.pages>0 then rank() over(partition by m.track,m.category_id order by m.points desc,m.pages desc,(m.penalty_units/nullif(m.pages,0)) asc nulls last,m.student_id) end as category_rank,
      count(*) over(partition by m.track,m.category_id) as category_total
    from metrics m
  ), mine as (
    select * from ranked where student_id=p_student_id
  ), rank_json as (
    select coalesce(jsonb_object_agg(track,jsonb_build_object(
      'points',round(points,2),'pages',round(pages,2),
      'halaqa_rank',halaqa_rank,'halaqa_total',halaqa_total,
      'category_rank',case when v_category is null then null else category_rank end,
      'category_total',case when v_category is null then null else category_total end
    )),'{}'::jsonb) value from mine
  ), daily as (
    select se.session_date,
      coalesce(sum(r.pages_count) filter(where r.activity_type='new_hifz'::public.activity_type),0)::numeric as hifz,
      coalesce(sum(r.pages_count) filter(where r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type)),0)::numeric as review,
      coalesce(sum(r.pages_count) filter(where r.activity_type='sard'::public.activity_type),0)::numeric as sard,
      round(avg(r.safety_percentage) filter(where r.safety_percentage is not null),1) as safety
    from public.recitation_entries r
    join public.sessions se on se.id=r.session_id
    where r.student_id=p_student_id
      and se.status <> 'cancelled'
      and se.session_date between p_from and p_to
    group by se.session_date
    order by se.session_date
  ), daily_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date',session_date,'hifz',round(hifz,2),'review',round(review,2),'sard',round(sard,2),'safety',safety
    ) order by session_date),'[]'::jsonb) value from daily
  ), attendance as (
    select
      count(*) filter(where ar.status in ('present'::public.attendance_status,'late'::public.attendance_status))::int as present,
      count(*) filter(where ar.status='absent'::public.attendance_status)::int as absent,
      count(*) filter(where ar.status='excused'::public.attendance_status)::int as excused,
      count(*) filter(where ar.status='late'::public.attendance_status)::int as late
    from public.attendance_records ar
    join public.sessions se on se.id=ar.session_id
    where ar.student_id=p_student_id and se.status<>'cancelled' and se.session_date between p_from and p_to
  )
  select jsonb_build_object(
    'from',p_from,'to',p_to,'track_code',v_track,
    'ranks',(select value from rank_json),
    'daily',(select value from daily_json),
    'attendance',jsonb_build_object('present',present,'absent',absent,'excused',excused,'late',late)
  ) into v_result from attendance;

  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.guardian_student_dashboard_range(uuid,date,date) from public;
grant execute on function public.guardian_student_dashboard_range(uuid,date,date) to authenticated;

-- Keep the legacy snapshot compatible, but fix the cohort: same halaqa + same student program track.
create or replace function public.student_rank_snapshot_range(
  p_student_id uuid,
  p_from date default current_date,
  p_to date default current_date
) returns table(track text, rank_no bigint, total_students bigint, points numeric, pages numeric)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  hid uuid;
  tcode text;
begin
  if not public.can_access_student(p_student_id) then raise exception 'not allowed' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_from>p_to then raise exception 'invalid date range'; end if;
  select s.halaqa_id,s.track_code into hid,tcode from public.students s where s.id=p_student_id;
  return query
  with tracks(track) as (values ('hifz'::text),('review'::text),('sard'::text)),
  base as (
    select s.id student_id,t.track,
      coalesce(sum(case
        when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.points
        when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.points
        when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.points else 0 end),0)::numeric points,
      coalesce(sum(case
        when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.pages_count
        when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.pages_count
        when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.pages_count else 0 end),0)::numeric pages,
      case when coalesce(sum(case when se.id is not null then r.pages_count else 0 end),0)>0
        then coalesce(sum(case when se.id is not null then r.penalty_units else 0 end),0)/nullif(sum(case when se.id is not null then r.pages_count else 0 end),0)
        else null end::numeric penalty_per_page
    from public.students s cross join tracks t
    left join public.recitation_entries r on r.student_id=s.id
    left join public.sessions se on se.id=r.session_id and se.status<>'cancelled' and se.session_date between p_from and p_to
    where s.halaqa_id=hid and s.status='active' and s.track_code is not distinct from tcode
    group by s.id,t.track
  ), ranked as (
    select b.*, case when b.pages>0 then rank() over(partition by b.track order by b.points desc,b.pages desc,b.penalty_per_page asc nulls last,b.student_id) end rn,
      count(*) over(partition by b.track) cnt from base b
  )
  select r.track,r.rn,r.cnt,r.points,r.pages from ranked r where r.student_id=p_student_id
  order by case r.track when 'hifz' then 1 when 'review' then 2 else 3 end;
end;
$$;
