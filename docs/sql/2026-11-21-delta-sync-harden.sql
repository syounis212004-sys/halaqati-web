-- Hardening for 2026-11-20-delta-sync.sql (security audit fingerprint delta-sync-change-log-ids-leak-outside-rls).   NOT APPLIED. Test on a branch/copy first.
-- Problem: rc_internal.events_since (SECURITY DEFINER) read the change log with no role/approval filter, so ANY authenticated JWT (including a pending,
--   unapproved or frozen account) learned table, row id and timing of rows outside its RLS scope, and composite student_guardians ids revealed
--   student_id:guardian_id links when a link was deleted.
-- Change (additive, create or replace only; no table/column/RLS change):
--   1. Only approved, active, non-frozen profiles receive any events. The rule mirrors the web client (auth/runtime.js): approval_status='approved',
--      active, and not frozen unless the account is an admin.
--   2. A caller who is NOT allowed no longer gets "no events and a cursor that moves on" (which would make the client skip every change made while the
--      account was blocked). rc_changes_since answers {full_resync:true, blocked:true, cursor:-1} and rc_change_head() answers -1, so the existing web
--      client stores cursor -1, which it already treats as "no cursor": it does a full reload as soon as the account is allowed again.
--   3. student_guardians change events (updates and deletes) are reported only to admins and to the guardian the link belongs to; staff and other
--      guardians reconcile through rc_visible_ids.
-- Contract change: the response of rc_changes_since gains an optional "blocked" key and rc_change_head() may return -1. Both are safe for the deployed
--   web client (unknown key ignored; -1 is stored and read as "no cursor"). The Android app does not call these RPCs. Deploy order: apply this SQL (the
--   client needs no change); roll back by re-running the original functions from 2026-11-20-delta-sync.sql.
-- Preflight: this script refuses to run if the objects it relies on are missing (public.is_admin(), profiles.role/active/approval_status/frozen).
begin;

do $$ begin
  if to_regprocedure('public.is_admin()') is null then raise exception 'preflight: public.is_admin() not found; do not apply'; end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
        and column_name in ('role', 'active', 'approval_status', 'frozen')) < 4 then
    raise exception 'preflight: public.profiles needs role, active, approval_status, frozen; do not apply'; end if;
  if to_regprocedure('rc_internal.events_since(bigint,text[],integer)') is null then raise exception 'preflight: apply 2026-11-20-delta-sync.sql first'; end if;
end $$;

-- Is the CALLER allowed to receive change events? (SECURITY DEFINER so it does not depend on the caller's RLS on profiles.)
create or replace function rc_internal.sync_allowed() returns boolean
language sql stable security definer set search_path = rc_internal, pg_temp as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.active is true and p.approval_status = 'approved' and (coalesce(p.frozen, false) = false or p.role = 'admin')) $$;
revoke all on function rc_internal.sync_allowed() from public, anon;
grant execute on function rc_internal.sync_allowed() to authenticated;

create or replace function rc_internal.events_since(p_cursor bigint, p_tables text[], p_limit int)
returns jsonb language sql stable security definer set search_path = rc_internal, pg_temp as $$
  with who as (select rc_internal.sync_allowed() as ok),
  latest as (
    select distinct on (l.tbl, l.row_id) l.tbl, l.row_id, l.op, l.seq
    from rc_internal.change_log l, who
    where who.ok and l.seq > p_cursor and l.at <= now() - interval '5 seconds' and l.tbl = any(p_tables) and rc_internal.sync_cfg() ? l.tbl
    order by l.tbl, l.row_id, l.seq desc),
  ev as (  -- filter AFTER picking the latest event per row, otherwise an earlier insert event of a hidden deleted link would surface as a delete id
    select * from latest
    where tbl <> 'student_guardians' or public.is_admin() or split_part(row_id, ':', 2) = auth.uid()::text),
  lim as (select * from ev order by seq limit p_limit)
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(jsonb_build_object('t', tbl, 'id', row_id, 'op', op, 'seq', seq) order by seq) from lim), '[]'::jsonb),
    'more',   (select count(*) from ev) > p_limit,
    'pruned', (select val from rc_internal.change_meta where key = 'pruned_upto'),
    'head',   (select coalesce(max(seq), p_cursor) from lim),
    'blocked', not (select ok from who)) $$;
revoke all on function rc_internal.events_since(bigint, text[], int) from public, anon;
grant execute on function rc_internal.events_since(bigint, text[], int) to authenticated;

create or replace function public.rc_change_head() returns bigint
language sql stable security invoker set search_path = public, rc_internal, pg_temp as $$
  select case when rc_internal.sync_allowed() then rc_internal.safe_head() else -1 end $$;

-- Same function as 2026-11-20-delta-sync.sql except the two marked lines: a blocked caller is told to resync (never silently "up to date").
create or replace function public.rc_changes_since(p_cursor bigint, p_tables text[], p_limit int default 2000)
returns jsonb language plpgsql stable security invoker set search_path = public, rc_internal, pg_temp as $$
declare
  cfg jsonb := rc_internal.sync_cfg(); ev jsonb; t text; ids text[]; rows jsonb; pkexpr text; strip text;
  ups jsonb := '{}'::jsonb; dels jsonb := '{}'::jsonb; cursor_out bigint;
begin
  if p_cursor is null or p_cursor < 0 then return jsonb_build_object('full_resync', true, 'cursor', case when rc_internal.sync_allowed() then rc_internal.safe_head() else -1 end); end if;  -- changed
  p_limit := least(greatest(coalesce(p_limit, 2000), 1), 5000);
  ev := rc_internal.events_since(p_cursor, p_tables, p_limit);
  if (ev ->> 'blocked')::boolean then return jsonb_build_object('full_resync', true, 'blocked', true, 'cursor', -1); end if;  -- added
  if p_cursor < coalesce((ev ->> 'pruned')::bigint, 0) then return jsonb_build_object('full_resync', true, 'cursor', rc_internal.safe_head()); end if;
  cursor_out := case when jsonb_array_length(ev -> 'events') = 0 and not (ev ->> 'more')::boolean then greatest(p_cursor, rc_internal.safe_head()) else (ev ->> 'head')::bigint end;

  for t in select distinct e ->> 't' from jsonb_array_elements(ev -> 'events') e loop
    select array_agg(e ->> 'id') into ids from jsonb_array_elements(ev -> 'events') e where e ->> 't' = t and e ->> 'op' = 'U';
    dels := dels || jsonb_build_object(t, coalesce((select jsonb_agg(e ->> 'id') from jsonb_array_elements(ev -> 'events') e where e ->> 't' = t and e ->> 'op' = 'D'), '[]'::jsonb));
    if ids is not null then
      pkexpr := (select string_agg(format('t.%I::text', c), ', ') from jsonb_array_elements_text(cfg -> t -> 'pk') c);
      strip  := coalesce((select string_agg(format('- %L', c), ' ') from jsonb_array_elements_text(cfg -> t -> 'strip') c), '');
      execute format('select coalesce(jsonb_agg(to_jsonb(t) %s), ''[]''::jsonb) from public.%I t where concat_ws('':'', %s) = any($1)', strip, t, pkexpr) into rows using ids;
      ups := ups || jsonb_build_object(t, rows);
      dels := jsonb_set(dels, array[t], (dels -> t) || coalesce((
        select jsonb_agg(i) from unnest(ids) i
        where not exists (select 1 from jsonb_array_elements(rows) r where rc_internal.row_key(r, cfg -> t -> 'pk') = i)), '[]'::jsonb));
    end if;
  end loop;
  return jsonb_build_object('full_resync', false, 'cursor', cursor_out, 'has_more', (ev ->> 'more')::boolean, 'upserts', ups, 'deletes', dels);
end $$;
revoke all on function public.rc_change_head(), public.rc_changes_since(bigint, text[], int) from public, anon;
grant execute on function public.rc_change_head(), public.rc_changes_since(bigint, text[], int) to authenticated;

commit;
