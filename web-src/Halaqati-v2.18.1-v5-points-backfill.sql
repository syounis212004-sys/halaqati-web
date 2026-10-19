-- Halaqati v2.18.1 — optional V5 points backfill
-- Run once ONLY if recitations were saved using v2.18.0 before installing v2.18.1.
-- It keeps V5 safety/evaluation logic intact and restores the usual ranking-points scale.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='recitation_entries' and column_name='scoring_version'
  ) then
    execute $sql$
      update public.recitation_entries
      set points = greatest(
        0::numeric,
        round(
          coalesce(pages_count,0)::numeric
          - 0.25::numeric * (coalesce(mistakes,0)::numeric + 0.5::numeric * coalesce(prompts,0)::numeric),
          2
        )
      )
      where scoring_version = 'V5'
    $sql$;
  end if;
end $$;
