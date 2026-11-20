-- Incremental (delta) sync for the Halaqati web app.            DRAFT: NOT applied. Review, test on a Supabase branch, then apply.
-- Why: no table has deleted_at, sessions/attendance_records/recitation_entries/... have no updated_at, and profiles/student_halaqa_memberships
-- have the column but no trigger, so "updated_at > cursor" cannot see deletes or most edits. This adds a change log + three read-only RPCs.
-- Security model:
--  * The change log lives in the NON-exposed schema rc_internal and stores only (table, row id, operation, time): no row content.
--  * The public RPCs are SECURITY INVOKER: every row they return passes the CALLER's own RLS. A row the caller cannot see is reported as
--    "deleted" so a copy that lost visibility is dropped on the client. Nothing here changes RLS or any existing table or column.
--  * Only the helper that reads the log is SECURITY DEFINER; it returns ids only.
-- Concurrency: sequence numbers can commit out of order, so events newer than 5 seconds are never delivered or counted in the cursor;
--   the client re-requests them next time (applying an upsert/delete twice is harmless).
-- Rollback: see the end of the file.

begin;

create schema if not exists rc_internal;
revoke all on schema rc_internal from public, anon;
grant usage on schema rc_internal to authenticated;

create sequence if not exists rc_internal.change_seq;

create table if not exists rc_internal.change_log (
  seq    bigint primary key default nextval('rc_internal.change_seq'),
  tbl    text    not null,
  row_id text    not null,
  op     char(1) not null check (op in ('U','D')),
  at     timestamptz not null default now()
);
create index if not exists change_log_tbl_row on rc_internal.change_log (tbl, row_id, seq desc);
create index if not exists change_log_at on rc_internal.change_log (at);
create table if not exists rc_internal.change_meta (key text primary key, val bigint not null);
insert into rc_internal.change_meta(key, val) values ('pruned_upto', 0) on conflict (key) do nothing;
revoke all on rc_internal.change_log, rc_internal.change_meta from public, anon, authenticated;

-- AFTER row trigger: the trigger arguments are the primary-key columns (composite keys are joined with ':').
create or replace function rc_internal.log_change() returns trigger
language plpgsql security definer set search_path = rc_internal, pg_temp as $$
declare j jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end); k text;
begin
  select string_agg(j ->> c, ':' order by ord) into k from unnest(tg_argv) with ordinality as a(c, ord);
  insert into rc_internal.change_log(tbl, row_id, op) values (tg_table_name, k, case when tg_op = 'DELETE' then 'D' else 'U' end);
  return null;
end $$;
revoke all on function rc_internal.log_change() from public, anon, authenticated;

do $$
declare t record;
begin
  for t in select * from (values
      ('halaqas','id'), ('students','id'), ('sessions','id'), ('halaqa_teachers','halaqa_id,teacher_id'),
      ('halaqa_supervisors','halaqa_id,supervisor_id'), ('student_halaqa_memberships','id'), ('announcements','id'),
      ('student_goals','id'), ('student_categories','id'), ('attendance_records','id'), ('student_daily_notes','id'),
      ('recitation_entries','id'), ('student_guardians','student_id,guardian_id')
    ) as v(tbl, pk)
  loop
    execute format('drop trigger if exists rc_log_change_trg on public.%I', t.tbl);
    execute format('create trigger rc_log_change_trg after insert or update or delete on public.%I for each row execute function rc_internal.log_change(%s)',
                   t.tbl, (select string_agg(quote_literal(c), ',') from unnest(string_to_array(t.pk, ',')) c));
  end loop;
end $$;

-- Synced tables, their key columns, and columns never returned (inline images are fetched separately by the client).
create or replace function rc_internal.sync_cfg() returns jsonb language sql immutable as $$
  select '{
    "halaqas":{"pk":["id"],"strip":["logo_path"]},
    "students":{"pk":["id"],"strip":["photo_path"]},
    "sessions":{"pk":["id"],"strip":[]},
    "halaqa_teachers":{"pk":["halaqa_id","teacher_id"],"strip":[]},
    "halaqa_supervisors":{"pk":["halaqa_id","supervisor_id"],"strip":[]},
    "student_halaqa_memberships":{"pk":["id"],"strip":[]},
    "announcements":{"pk":["id"],"strip":[]},
    "student_goals":{"pk":["id"],"strip":[]},
    "student_categories":{"pk":["id"],"strip":[]},
    "attendance_records":{"pk":["id"],"strip":[]},
    "student_daily_notes":{"pk":["id"],"strip":[]},
    "recitation_entries":{"pk":["id"],"strip":[]},
    "student_guardians":{"pk":["student_id","guardian_id"],"strip":[]}
  }'::jsonb $$;
grant execute on function rc_internal.sync_cfg() to authenticated;

create or replace function rc_internal.row_key(r jsonb, pk jsonb) returns text language sql immutable as $$
  select string_agg(r ->> c, ':' order by ord) from jsonb_array_elements_text(pk) with ordinality as a(c, ord) $$;
grant execute on function rc_internal.row_key(jsonb, jsonb) to authenticated;

-- The cursor safe to start from (older than the 5 second out-of-order window).
create or replace function rc_internal.safe_head() returns bigint
language sql stable security definer set search_path = rc_internal, pg_temp as $$
  select coalesce(max(seq), 0) from rc_internal.change_log where at <= now() - interval '5 seconds' $$;
revoke all on function rc_internal.safe_head() from public, anon;
grant execute on function rc_internal.safe_head() to authenticated;

-- Ids only: the latest event per (table, row) after the cursor, oldest first, at most p_limit, plus whether more exist.
create or replace function rc_internal.events_since(p_cursor bigint, p_tables text[], p_limit int)
returns jsonb language sql stable security definer set search_path = rc_internal, pg_temp as $$
  with ev as (
    select distinct on (l.tbl, l.row_id) l.tbl, l.row_id, l.op, l.seq
    from rc_internal.change_log l
    where l.seq > p_cursor and l.at <= now() - interval '5 seconds' and l.tbl = any(p_tables) and rc_internal.sync_cfg() ? l.tbl
    order by l.tbl, l.row_id, l.seq desc),
  lim as (select * from ev order by seq limit p_limit)
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(jsonb_build_object('t', tbl, 'id', row_id, 'op', op, 'seq', seq) order by seq) from lim), '[]'::jsonb),
    'more',   (select count(*) from ev) > p_limit,
    'pruned', (select val from rc_internal.change_meta where key = 'pruned_upto'),
    'head',   (select coalesce(max(seq), p_cursor) from lim)) $$;
revoke all on function rc_internal.events_since(bigint, text[], int) from public, anon;
grant execute on function rc_internal.events_since(bigint, text[], int) to authenticated;

create or replace function public.rc_change_head() returns bigint
language sql stable security invoker set search_path = public, rc_internal, pg_temp as $$ select rc_internal.safe_head() $$;

-- Changes after p_cursor for the requested tables.
create or replace function public.rc_changes_since(p_cursor bigint, p_tables text[], p_limit int default 2000)
returns jsonb language plpgsql stable security invoker set search_path = public, rc_internal, pg_temp as $$
declare
  cfg jsonb := rc_internal.sync_cfg(); ev jsonb; t text; ids text[]; rows jsonb; pkexpr text; strip text;
  ups jsonb := '{}'::jsonb; dels jsonb := '{}'::jsonb; cursor_out bigint;
begin
  if p_cursor is null or p_cursor < 0 then return jsonb_build_object('full_resync', true, 'cursor', rc_internal.safe_head()); end if;
  p_limit := least(greatest(coalesce(p_limit, 2000), 1), 5000);
  ev := rc_internal.events_since(p_cursor, p_tables, p_limit);
  if p_cursor < coalesce((ev ->> 'pruned')::bigint, 0) then return jsonb_build_object('full_resync', true, 'cursor', rc_internal.safe_head()); end if;
  -- no events: the cursor can move to the safe head (everything older was filtered out); with events it stops at the last one returned
  cursor_out := case when jsonb_array_length(ev -> 'events') = 0 and not (ev ->> 'more')::boolean then greatest(p_cursor, rc_internal.safe_head()) else (ev ->> 'head')::bigint end;

  for t in select distinct e ->> 't' from jsonb_array_elements(ev -> 'events') e loop
    select array_agg(e ->> 'id') into ids from jsonb_array_elements(ev -> 'events') e where e ->> 't' = t and e ->> 'op' = 'U';
    dels := dels || jsonb_build_object(t, coalesce((select jsonb_agg(e ->> 'id') from jsonb_array_elements(ev -> 'events') e where e ->> 't' = t and e ->> 'op' = 'D'), '[]'::jsonb));
    if ids is not null then
      pkexpr := (select string_agg(format('t.%I::text', c), ', ') from jsonb_array_elements_text(cfg -> t -> 'pk') c);
      strip  := coalesce((select string_agg(format('- %L', c), ' ') from jsonb_array_elements_text(cfg -> t -> 'strip') c), '');
      -- the caller's RLS decides which of these rows are returned
      execute format('select coalesce(jsonb_agg(to_jsonb(t) %s), ''[]''::jsonb) from public.%I t where concat_ws('':'', %s) = any($1)', strip, t, pkexpr) into rows using ids;
      ups := ups || jsonb_build_object(t, rows);
      -- updated rows that are no longer visible to the caller (moved out, permission lost) are reported as deletes
      dels := jsonb_set(dels, array[t], (dels -> t) || coalesce((
        select jsonb_agg(i) from unnest(ids) i
        where not exists (select 1 from jsonb_array_elements(rows) r where rc_internal.row_key(r, cfg -> t -> 'pk') = i)), '[]'::jsonb));
    end if;
  end loop;
  return jsonb_build_object('full_resync', false, 'cursor', cursor_out, 'has_more', (ev ->> 'more')::boolean, 'upserts', ups, 'deletes', dels);
end $$;

-- Ids the caller can currently see (RLS applies); the client drops local rows that are not listed (scope loss, moves, unlinks).
create or replace function public.rc_visible_ids(p_table text) returns text[]
language plpgsql stable security invoker set search_path = public, rc_internal, pg_temp as $$
declare cfg jsonb := rc_internal.sync_cfg(); pkexpr text; r text[];
begin
  if not (cfg ? p_table) then raise exception 'table not synced: %', p_table using errcode = '22023'; end if;
  pkexpr := (select string_agg(format('t.%I::text', c), ', ') from jsonb_array_elements_text(cfg -> p_table -> 'pk') c);
  execute format('select coalesce(array_agg(concat_ws('':'', %s)), ''{}'') from public.%I t', pkexpr, p_table) into r;
  return r;
end $$;

-- Retention: keep 30 days; a client whose cursor is older than pruned_upto is told to do a full resync. Schedule it (pg_cron) or run by hand.
create or replace function rc_internal.prune_change_log(p_keep interval default interval '30 days') returns bigint
language plpgsql security definer set search_path = rc_internal, pg_temp as $$
declare cut bigint;
begin
  select coalesce(max(seq), 0) into cut from rc_internal.change_log where at < now() - p_keep;
  delete from rc_internal.change_log where seq <= cut;
  update rc_internal.change_meta set val = greatest(val, cut) where key = 'pruned_upto';
  return cut;
end $$;
revoke all on function rc_internal.prune_change_log(interval) from public, anon, authenticated;

revoke all on function public.rc_change_head(), public.rc_changes_since(bigint, text[], int), public.rc_visible_ids(text) from public, anon;
grant execute on function public.rc_change_head(), public.rc_changes_since(bigint, text[], int), public.rc_visible_ids(text) to authenticated;

commit;

-- ------------------------------------------------------------ verification (apply on a BRANCH first; run as a real authenticated user) --
-- select public.rc_change_head();
-- select public.rc_changes_since(0, array['students','halaqas']);        -- full_resync=false, upserts/deletes (only rows this user can see)
-- select public.rc_changes_since(-1, array['students']);                 -- full_resync=true
-- select array_length(public.rc_visible_ids('students'), 1);             -- = number of students this user can see
-- select * from rc_internal.change_log;                                  -- must fail with permission denied for authenticated/anon
-- Update a student in one halaqa as admin, then call rc_changes_since as a teacher of ANOTHER halaqa: that student must not appear in upserts.
-- Delete a test row, wait 6 seconds, call rc_changes_since: the id appears in deletes.

-- ------------------------------------------------------------ rollback ---------------------------------------------------------------
-- do $$ declare t text; begin
--   for t in select unnest(array['halaqas','students','sessions','halaqa_teachers','halaqa_supervisors','student_halaqa_memberships','announcements',
--     'student_goals','student_categories','attendance_records','student_daily_notes','recitation_entries','student_guardians'])
--   loop execute format('drop trigger if exists rc_log_change_trg on public.%I', t); end loop; end $$;
-- drop function if exists public.rc_change_head(), public.rc_changes_since(bigint, text[], int), public.rc_visible_ids(text);
-- drop schema rc_internal cascade;
