-- M2: compact ranking source for the Android app.                    DRAFT: NOT applied. Test on a branch/copy first.
-- Why: the 62-day ranking source is ~1.29 MB for ~1,100 rows; selection_data is ~64% of it, yet the app only needs the NUMBER of distinct
-- non-blank qcf_line_keys (RecitationParityRules.effectivePages). This returns the same rows with selection_data = {"qcf_line_count": n}.
-- Security: SECURITY INVOKER + STABLE, no writes, no new table/column, no RLS change: every row passes the caller's own RLS on the three tables.
-- The client falls back to the old REST select when this function is absent (PGRST202), so applying it is optional and reversible.
-- Rollback: drop function public.rc_ranking_source(date, integer);
create or replace function public.rc_ranking_source(p_from date, p_limit integer default 5000)
returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(row_json), '[]'::jsonb) from (
    select jsonb_build_object(
      'student_id', e.student_id, 'pages_count', e.pages_count, 'mistakes', e.mistakes, 'prompts', e.prompts, 'points', e.points,
      'activity_type', e.activity_type, 'start_surah', e.start_surah, 'start_ayah', e.start_ayah, 'end_surah', e.end_surah, 'end_ayah', e.end_ayah,
      'selection_data', jsonb_build_object('qcf_line_count', coalesce((
          select count(distinct k) from jsonb_array_elements_text(
            case when jsonb_typeof(e.selection_data -> 'qcf_line_keys') = 'array' then e.selection_data -> 'qcf_line_keys' else '[]'::jsonb end) k
          where btrim(k) <> ''), 0)),
      'students', jsonb_build_object('full_name', st.full_name, 'category_id', st.category_id, 'track_code', st.track_code),
      'sessions', jsonb_build_object('session_date', s.session_date)) as row_json
    from public.recitation_entries e
    join public.students st on st.id = e.student_id
    join public.sessions s on s.id = e.session_id
    where s.session_date >= p_from and s.status is distinct from 'cancelled'
    limit greatest(1, least(coalesce(p_limit, 5000), 20000))
  ) q;
$$;
revoke all on function public.rc_ranking_source(date, integer) from public, anon;
grant execute on function public.rc_ranking_source(date, integer) to authenticated;
