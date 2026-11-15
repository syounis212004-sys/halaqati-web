-- Optional, NOT applied automatically. A daily session whose day has passed becomes 'closed'.
-- The web supervisor screens already treat such sessions as finished; this makes the stored status match.
create or replace function public.halaqati_close_past_sessions()
returns integer
language sql
security definer
set search_path = public
as $$
  with c as (
    update public.sessions
       set status = 'closed'
     where status = 'open'
       and session_date < (now() at time zone 'Asia/Amman')::date
    returning 1
  )
  select count(*)::int from c;
$$;
revoke all on function public.halaqati_close_past_sessions() from public, anon, authenticated;
-- run once:      select public.halaqati_close_past_sessions();
-- run every day (needs the pg_cron extension): 
--   select cron.schedule('close-past-sessions','5 21 * * *','select public.halaqati_close_past_sessions()');
-- closed sessions stay editable: «فتح للتعديل» (reopenSession) sets them back to 'open'.
