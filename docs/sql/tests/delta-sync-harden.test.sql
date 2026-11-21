\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
-- stubs for the Supabase pieces the hardening depends on (dummy data only)
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table public.profiles(id uuid primary key, role text, active boolean default true, approval_status text default 'approved', frozen boolean default false);
grant select on public.profiles to authenticated;
create function public.is_admin() returns boolean language sql stable security definer as $$ select current_setting('app.role', true) = 'admin' $$;
grant execute on function public.is_admin() to authenticated;
\i /home/user/halaqati-web/docs/sql/2026-11-21-delta-sync-harden.sql
insert into profiles values ('aaaaaaaa-0000-0000-0000-00000000000a','guardian',true,'approved',false),('bbbbbbbb-0000-0000-0000-00000000000b','guardian',true,'approved',false),('cccccccc-0000-0000-0000-00000000000c','guardian',true,'pending',false),('dddddddd-0000-0000-0000-00000000000d','guardian',true,'approved',true),('99999999-0000-0000-0000-000000000009','admin',true,'approved',false);
insert into student_guardians values ('51000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a'),('52000000-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-00000000000b');
delete from student_guardians;
update rc_internal.change_log set at = at - interval '10 seconds';
set role authenticated; set app.role='guardian';
set app.uid='aaaaaaaa-0000-0000-0000-00000000000a';
select 'H1 guardianA deletes=' || (public.rc_changes_since(0, array['student_guardians'])->'deletes'->'student_guardians')::text || ' (expect only A own link)';
set app.uid='bbbbbbbb-0000-0000-0000-00000000000b';
select 'H2 guardianB deletes=' || (public.rc_changes_since(0, array['student_guardians'])->'deletes'->'student_guardians')::text || ' (expect only B own link)';
set app.uid='cccccccc-0000-0000-0000-00000000000c';
select 'H3 pending events=' || coalesce((public.rc_changes_since(0, array['student_guardians'])->'deletes'->'student_guardians')::text, 'null') || ' (expect null or empty)';
set app.uid='dddddddd-0000-0000-0000-00000000000d';
select 'H4 frozen events=' || coalesce((public.rc_changes_since(0, array['student_guardians'])->'deletes'->'student_guardians')::text, 'null') || ' (expect null or empty)';
set app.uid='99999999-0000-0000-0000-000000000009'; set app.role='admin';
select 'H5 admin deletes count=' || jsonb_array_length(public.rc_changes_since(0, array['student_guardians'])->'deletes'->'student_guardians') || ' (expect 2)';
reset role;

-- ---- blocked callers must be told to resync, never "up to date"; reactivation must not lose changes ----
insert into profiles values ('ffffffff-0000-0000-0000-00000000000f','admin',true,'approved',true),   -- frozen ADMIN: the web client lets admins through
  ('eeeeeeee-0000-0000-0000-00000000000e','teacher',true,'approved',false),('11111111-0000-0000-0000-000000000011','teacher',false,'approved',false);
set role authenticated; set app.role='guardian';
set app.uid='cccccccc-0000-0000-0000-00000000000c';
select 'H6 pending => ' || (public.rc_changes_since(0, array['student_guardians']))::text || ' (expect full_resync true, blocked true, cursor -1)';
select 'H7a pending head=' || public.rc_change_head() || ' (expect -1)';
set app.uid='aaaaaaaa-0000-0000-0000-00000000000a';
select 'H7b approved head>0=' || (public.rc_change_head() > 0) || ' (expect true)';
set app.uid='11111111-0000-0000-0000-000000000011';
select 'H8 inactive => ' || (public.rc_changes_since(0, array['halaqas'])->>'blocked') || ' (expect true)';
set app.uid='ffffffff-0000-0000-0000-00000000000f'; set app.role='admin';
select 'H9 frozen admin delivered: blocked=' || coalesce(public.rc_changes_since(0, array['student_guardians'])->>'blocked','absent') || ' deletes=' || jsonb_array_length(public.rc_changes_since(0, array['student_guardians'])->'deletes'->'student_guardians') || ' (expect absent, 2)';
reset role;
-- H10: a teacher is frozen while changes happen, then reactivated
insert into halaqas(id, name) values ('a0000000-0000-0000-0000-0000000000a1', 'before');
update rc_internal.change_log set at = at - interval '10 seconds';
set role authenticated; set app.role='teacher'; set app.uid='eeeeeeee-0000-0000-0000-00000000000e';
select public.rc_change_head() as n \gset
reset role;
update profiles set frozen = true where id = 'eeeeeeee-0000-0000-0000-00000000000e';
insert into halaqas(id, name) values ('a0000000-0000-0000-0000-0000000000a2', 'while frozen');
update rc_internal.change_log set at = at - interval '10 seconds';
set role authenticated; set app.role='teacher'; set app.uid='eeeeeeee-0000-0000-0000-00000000000e';
select 'H10a frozen => ' || (public.rc_changes_since(:n, array['halaqas']))::text || ' (expect full_resync true, blocked true)';
select 'H10b frozen head=' || public.rc_change_head() || ' (the client stores this as its cursor; expect -1)';
reset role;
update profiles set frozen = false where id = 'eeeeeeee-0000-0000-0000-00000000000e';
set role authenticated; set app.role='teacher'; set app.uid='eeeeeeee-0000-0000-0000-00000000000e';
select 'H10c reactivated with the stored -1 => full_resync=' || (public.rc_changes_since(-1, array['halaqas'])->>'full_resync') || ' cursor>0=' || ((public.rc_changes_since(-1, array['halaqas'])->>'cursor')::bigint > 0) || ' (expect true, true: client reloads everything)';
select 'H10d old cursor still sees the change made while frozen=' || ((public.rc_changes_since(:n, array['halaqas'])->'upserts'->'halaqas') @> '[{"id":"a0000000-0000-0000-0000-0000000000a2"}]'::jsonb) || ' (expect true)';
reset role;

