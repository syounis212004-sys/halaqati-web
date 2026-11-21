-- Hardening for 2026-11-20-delta-sync.sql (security audit fingerprint delta-sync-change-log-ids-leak-outside-rls).   NOT APPLIED. Test on a branch/copy first.
-- Problem: rc_internal.events_since (SECURITY DEFINER) read the change log with no role/approval filter, so ANY authenticated JWT (including a pending,
--   unapproved or frozen account) learned table, row id and timing of rows outside its RLS scope, and composite student_guardians ids revealed
--   student_id:guardian_id links when a link was deleted.
-- Change (additive, create or replace only; no table/column/RLS change):
--   1. Only approved, active, non-frozen profiles receive any events (others get an empty answer, the cursor does not move).
--   2. student_guardians change events (updates and deletes) are reported only to admins and to the guardian the link belongs to; staff and other guardians reconcile through rc_visible_ids.
-- Rollback: re-run the original rc_internal.events_since from 2026-11-20-delta-sync.sql.
create or replace function rc_internal.events_since(p_cursor bigint, p_tables text[], p_limit int)
returns jsonb language sql stable security definer set search_path = rc_internal, pg_temp as $$
  with who as (
    select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active is true and p.approval_status = 'approved' and coalesce(p.frozen, false) = false) as ok),
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
    'head',   (select coalesce(max(seq), p_cursor) from lim)) $$;
revoke all on function rc_internal.events_since(bigint, text[], int) from public, anon;
grant execute on function rc_internal.events_since(bigint, text[], int) to authenticated;
