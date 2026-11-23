-- Recitation scoring V7 (the circle's rule): a mistake is a phrase, a prompt is one word (two harakat = one prompt).
-- The most allowed on one page is ONE mistake and TWO prompts; a started page has the full allowance, more pages allow proportionally more.
--   safety = 100 - (20*mistakes + 5*prompts) / pages ; over the allowance is always 'repeat' and never shows 70% or more.
--   points = pages - 0.25 * (mistakes + prompts/4)
-- Replaces the trigger function only. Existing rows keep their old v4 values (no backfill); new and edited rows get v7.
create or replace function public.compute_recitation_scoring()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m numeric := greatest(coalesce(new.mistakes,0),0);
  pr numeric := greatest(coalesce(new.prompts,0),0);
  pg numeric := greatest(coalesce(new.pages_count,0),0);
  lines numeric := 0;
  pe numeric;
  allowance numeric;
  over_ boolean;
  raw numeric;
  s numeric;
  units numeric;
begin
  begin
    select count(distinct k) into lines
      from jsonb_array_elements_text(coalesce(new.selection_data->'qcf_line_keys','[]'::jsonb)) k;
  exception when others then
    lines := 0;
  end;
  if coalesce(lines,0) <= 0 then lines := pg * 15; end if;

  new.scoring_version := 'v7';
  units := m + pr / 4.0;
  new.penalty_units := round(units,2);

  if pg <= 0 or lines <= 0 then
    new.penalty_per_page := null;
    new.evaluation := 'not_rated';
    new.safety_percentage := 0;
    new.points := 0;
    return new;
  end if;

  pe := lines / 15.0;
  allowance := greatest(1, ceil(pe - 0.000000001));
  over_ := m > allowance or pr > 2 * allowance;
  raw := 100 - (15 * (20 * m + 5 * pr)) / lines;
  s := greatest(0, least(100, case when over_ then least(raw, 69.9) else raw end));

  new.safety_percentage := round(s,1);
  new.penalty_per_page := round(units / pg, 3);
  -- the grade follows the percentage that is shown (rounded), the same as the web and the app
  new.evaluation := case when over_ then 'repeat' when new.safety_percentage >= 90 then 'excellent' when new.safety_percentage >= 80 then 'very_good' when new.safety_percentage >= 70 then 'good' else 'repeat' end;
  new.points := greatest(round(pg - units * 0.25, 2), 0); -- units has a quarter step, so this is exact
  return new;
end $function$;
