\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
-- seed as superuser (no RLS) : halaqa A/B, students, teachers
insert into halaqas(id,name,logo_path) values ('aaaaaaaa-0000-0000-0000-000000000001','A','data:logo'),('bbbbbbbb-0000-0000-0000-000000000002','B',null);
insert into halaqa_teachers values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001'),('bbbbbbbb-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002');
insert into students(id,full_name,halaqa_id,photo_path) values ('51000000-0000-0000-0000-000000000001','s1','aaaaaaaa-0000-0000-0000-000000000001','data:photo'),('52000000-0000-0000-0000-000000000002','s2','bbbbbbbb-0000-0000-0000-000000000002','data:p2');
select 'events logged: ' || count(*) from rc_internal.change_log;
-- age events beyond the 5 s window
update rc_internal.change_log set at = at - interval '10 seconds';
-- 1. admin: everything, photo/logo stripped
set role authenticated; set app.role='admin'; set app.uid='99999999-0000-0000-0000-000000000009';
select 'T1 full_resync=' || (r->>'full_resync') || ' students=' || jsonb_array_length(r->'upserts'->'students') || ' halaqas=' || jsonb_array_length(r->'upserts'->'halaqas') || ' photo_stripped=' || (not (r->'upserts'->'students'->0 ? 'photo_path')) || ' logo_stripped=' || (not (r->'upserts'->'halaqas'->0 ? 'logo_path')) || ' teachers_key=' || (r->'deletes'->'halaqa_teachers')::text from (select public.rc_changes_since(0, array['students','halaqas','halaqa_teachers']) r) x;
-- composite key event for teachers: upsert rows are returned for halaqa_teachers
select 'T1b teachers upserts=' || jsonb_array_length(public.rc_changes_since(0, array['halaqa_teachers'])->'upserts'->'halaqa_teachers');
-- 2. teacher of halaqa B must not receive student s1 (halaqa A) as an upsert, and must be told to drop it
reset role; set role authenticated; set app.role='teacher'; set app.uid='22222222-0000-0000-0000-000000000002';
select 'T2 teacherB upserts=' || (select jsonb_agg(e->>'full_name')::text from jsonb_array_elements(public.rc_changes_since(0, array['students'])->'upserts'->'students') e) || ' drop=' || (public.rc_changes_since(0, array['students'])->'deletes'->'students')::text;
-- 3. visible ids follow RLS
select 'T3 visible_ids(students)=' || array_length(public.rc_visible_ids('students'),1) || ' admin?no teacher sees only own';
-- 4. direct access to the log is denied
do $$ begin perform 1 from rc_internal.change_log limit 1; raise exception 'LEAK'; exception when insufficient_privilege then raise notice 'T4 log denied: ok'; end $$;
-- 5. unknown table rejected
do $$ begin perform public.rc_visible_ids('profiles'); raise exception 'NOT REJECTED'; exception when invalid_parameter_value then raise notice 'T5 unknown table rejected: ok'; end $$;
-- 6. full resync for negative cursor and for cursor below pruned_upto
select 'T6 neg=' || (public.rc_changes_since(-1, array['students'])->>'full_resync');
reset role;
-- 7. delete event + fresh events are withheld inside the 5 s window
delete from students where id='52000000-0000-0000-0000-000000000002';
set role authenticated; set app.role='admin'; set app.uid='99999999-0000-0000-0000-000000000009';
select 'T7a fresh delete withheld=' || (jsonb_array_length(coalesce(public.rc_changes_since((select public.rc_change_head()), array['students'])->'deletes'->'students','[]'::jsonb)) = 0);
reset role; update rc_internal.change_log set at = at - interval '10 seconds';
set role authenticated; set app.role='admin'; set app.uid='99999999-0000-0000-0000-000000000009';
select 'T7b delete delivered=' || (public.rc_changes_since(0, array['students'])->'deletes'->'students')::text;
-- 8. cursor advances; second call with the returned cursor returns nothing
select 'T8 second call empty=' || (jsonb_array_length(coalesce(public.rc_changes_since((public.rc_changes_since(0, array['students','halaqas','halaqa_teachers'])->>'cursor')::bigint, array['students','halaqas'])->'upserts'->'students','[]'::jsonb)) = 0);
-- 9. has_more with limit 1, then continue with the returned cursor
select 'T9 has_more=' || (public.rc_changes_since(0, array['students','halaqas','halaqa_teachers'], 1)->>'has_more');
select 'T9b pages=' || (with recursive p(cur,n) as (select 0::bigint,0 union all select (public.rc_changes_since(cur, array['students','halaqas','halaqa_teachers'], 1)->>'cursor')::bigint, n+1 from p where n<10 and (public.rc_changes_since(cur, array['students','halaqas','halaqa_teachers'], 1)->>'has_more')::boolean) select max(n) from p);
-- 10. update on a row that is now invisible to another teacher is reported as a drop
reset role; update students set full_name='s1-renamed' where id='51000000-0000-0000-0000-000000000001'; update rc_internal.change_log set at = at - interval '10 seconds';
set role authenticated; set app.role='teacher'; set app.uid='22222222-0000-0000-0000-000000000002';
select 'T10 renamed student of A -> teacherB drop=' || (public.rc_changes_since(0, array['students'])->'deletes'->'students')::text;
reset role;
update rc_internal.change_meta set val = (select max(seq) from rc_internal.change_log) where key='pruned_upto';
set role authenticated; set app.role='admin'; set app.uid='99999999-0000-0000-0000-000000000009';
select 'T11 cursor older than pruned_upto -> full_resync=' || (public.rc_changes_since(1, array['students'])->>'full_resync');
