-- Halaqati v2.17.5 — guardian arbitrary date-range analytics
-- Adds backwards-compatible RPCs; existing day/month RPCs stay untouched.

create or replace function public.guardian_competition_board_range(
  p_student_id uuid,
  p_track text default 'hifz',
  p_scope text default 'center',
  p_from date default current_date,
  p_to date default current_date
)
returns table(
  rank_no integer,
  total_students integer,
  student_id uuid,
  full_name text,
  category_name text,
  halaqa_name text,
  pages numeric,
  points numeric,
  is_my_child boolean,
  avg_pages numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_role public.app_role;
  v_category uuid;
  v_halaqa uuid;
begin
  v_role := public.current_role();
  if v_role is distinct from 'guardian'::public.app_role then
    raise exception 'guardian access only';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range';
  end if;

  if not exists (
    select 1
    from public.student_guardians sg
    join public.students s0 on s0.id = sg.student_id
    where sg.student_id = p_student_id
      and sg.guardian_id = auth.uid()
      and s0.status = 'active'
  ) then
    raise exception 'student is not linked to this guardian';
  end if;

  if p_track not in ('hifz','review','sard') then raise exception 'invalid track'; end if;
  if p_scope not in ('center','category','halaqa') then raise exception 'invalid scope'; end if;

  select s0.category_id, s0.halaqa_id
    into v_category, v_halaqa
  from public.students s0
  where s0.id = p_student_id;

  if p_scope = 'category' and v_category is null then return; end if;

  return query
  with eligible as (
    select s0.id, s0.full_name, s0.category_id, s0.halaqa_id,
           c.name as cat_name, h.name as hq_name
    from public.students s0
    left join public.student_categories c on c.id = s0.category_id
    join public.halaqas h on h.id = s0.halaqa_id
    where s0.status = 'active'
      and (
        p_scope = 'center'
        or (p_scope = 'category' and s0.category_id = v_category)
        or (p_scope = 'halaqa' and s0.halaqa_id = v_halaqa)
      )
  ), scored as (
    select e.id as sid, e.full_name as sname, e.cat_name, e.hq_name,
           coalesce(sum(case
             when se.id is not null and p_track = 'hifz' and r.activity_type = 'new_hifz'::public.activity_type then r.pages_count
             when se.id is not null and p_track = 'review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.pages_count
             when se.id is not null and p_track = 'sard' and r.activity_type = 'sard'::public.activity_type then r.pages_count
             else 0 end),0)::numeric as pg,
           coalesce(sum(case
             when se.id is not null and p_track = 'hifz' and r.activity_type = 'new_hifz'::public.activity_type then r.points
             when se.id is not null and p_track = 'review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.points
             when se.id is not null and p_track = 'sard' and r.activity_type = 'sard'::public.activity_type then r.points
             else 0 end),0)::numeric as pts
    from eligible e
    left join public.recitation_entries r on r.student_id = e.id
    left join public.sessions se on se.id = r.session_id
      and se.status <> 'cancelled'
      and se.session_date between p_from and p_to
    group by e.id, e.full_name, e.cat_name, e.hq_name
  ), ranked as (
    select sc.*,
           row_number() over(order by sc.pts desc, sc.pg desc, sc.sname asc)::int as rn,
           count(*) over()::int as cnt,
           avg(sc.pg) over()::numeric as avpg
    from scored sc
  ), mine as (
    select rr.rn as my_rank from ranked rr where rr.sid = p_student_id
  )
  select rr.rn, rr.cnt, rr.sid, rr.sname, rr.cat_name, rr.hq_name,
         rr.pg, rr.pts, (rr.sid = p_student_id), round(rr.avpg,2)
  from ranked rr
  cross join mine mm
  where rr.rn <= 5 or abs(rr.rn - mm.my_rank) <= 2
  order by rr.rn;
end;
$$;

create or replace function public.student_rank_snapshot_range(
  p_student_id uuid,
  p_from date default current_date,
  p_to date default current_date
)
returns table(
  track text,
  rank_no bigint,
  total_students bigint,
  points numeric,
  pages numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  hid uuid;
begin
  if not public.can_access_student(p_student_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range';
  end if;

  select s.halaqa_id into hid
  from public.students s
  where s.id = p_student_id;

  return query
  with tracks(track) as (
    values ('hifz'::text),('review'::text),('sard'::text)
  ), base as (
    select s.id as student_id,
           t.track,
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
           case when coalesce(sum(case
             when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.pages_count
             when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.pages_count
             when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.pages_count
             else 0 end),0) > 0
           then coalesce(sum(case
             when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.penalty_units
             when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.penalty_units
             when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.penalty_units
             else 0 end),0)
             / nullif(sum(case
             when se.id is not null and t.track='hifz' and r.activity_type='new_hifz'::public.activity_type then r.pages_count
             when se.id is not null and t.track='review' and r.activity_type in ('review_near'::public.activity_type,'review_far'::public.activity_type,'tilawah'::public.activity_type) then r.pages_count
             when se.id is not null and t.track='sard' and r.activity_type='sard'::public.activity_type then r.pages_count
             else 0 end),0)
           else null end::numeric as penalty_per_page
    from public.students s
    cross join tracks t
    left join public.recitation_entries r on r.student_id = s.id
    left join public.sessions se on se.id = r.session_id
      and se.status <> 'cancelled'
      and se.session_date between p_from and p_to
    where s.halaqa_id = hid and s.status='active'
    group by s.id,t.track
  ), ranked as (
    select b.*,
           rank() over(partition by b.track order by b.points desc,b.pages desc,b.penalty_per_page asc nulls last,b.student_id) as rank_no,
           count(*) over(partition by b.track) as total_students
    from base b
  )
  select r.track,r.rank_no,r.total_students,r.points,r.pages
  from ranked r
  where r.student_id=p_student_id
  order by case r.track when 'hifz' then 1 when 'review' then 2 else 3 end;
end;
$$;

grant execute on function public.guardian_competition_board_range(uuid,text,text,date,date) to authenticated;
grant execute on function public.student_rank_snapshot_range(uuid,date,date) to authenticated;
