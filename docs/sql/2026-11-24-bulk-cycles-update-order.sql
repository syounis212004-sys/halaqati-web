-- rc113_bulk_configure_plan_cycles: update the two phases in an order that never overlaps in between.
-- The trigger rc112_validate_phase_mutation checks every single UPDATE, so moving the Hifz end up to or past the old Sard start failed with
-- "RC11.2: smart plan phases may not overlap" (the whole bulk request was rolled back and nothing was saved).
-- Fix: when the new Hifz end reaches the old Sard start, move the Sard phase first; otherwise move Hifz first (as before).
-- Everything else in the function is unchanged.
create or replace function public.rc113_bulk_configure_plan_cycles(p_rows jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare
  item jsonb;
  sp public.smart_plans%rowtype;
  sid uuid;
  plan_id uuid;
  hifz_id uuid;
  sard_id uuid;
  sard_pre_start date;
  sard_done boolean;
  hifz_start date;
  hifz_end date;
  sard_start date;
  sard_end date;
  completed_pages numeric;
  hifz_target numeric;
  pct numeric;
  sard_target numeric;
  carry numeric;
  route text;
  weekdays smallint[];
  sard_state text;
  state_id uuid;
  event_id uuid;
  moved integer := 0;
  prepared integer := 0;
  scheduled integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'RC11.3: p_rows must be an array';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    plan_id := (item->>'plan_id')::uuid;
    sid := (item->>'student_id')::uuid;
    hifz_start := (item->>'hifz_start_date')::date;
    hifz_end := (item->>'hifz_end_date')::date;
    sard_start := (item->>'sard_start_date')::date;
    sard_end := (item->>'sard_end_date')::date;
    completed_pages := greatest(coalesce((item->>'hifz_completed_pages')::numeric, 0), 0);
    hifz_target := nullif(item->>'hifz_target_pages', '')::numeric;
    pct := nullif(item->>'hifz_completion_percent', '')::numeric;
    sard_target := greatest(coalesce((item->>'sard_target_pages')::numeric, 25), 0.01);
    carry := greatest(coalesce((item->>'carry_shortfall_pages')::numeric, 0), 0);
    route := coalesce(nullif(item->>'sard_route_direction', ''), 'reverse_surahs_forward_ayahs');
    weekdays := coalesce(
      array(select jsonb_array_elements_text(coalesce(item->'sard_weekdays', '[0,1,2,3,4,5]'::jsonb))::smallint),
      array[0,1,2,3,4,5]::smallint[]
    );

    if hifz_end < hifz_start then
      raise exception 'RC11.3: invalid Hifz date range for plan %', plan_id;
    end if;
    if sard_start <= hifz_end then
      raise exception 'RC11.3: Sard must start after Hifz for plan %', plan_id;
    end if;
    if sard_end < sard_start then
      raise exception 'RC11.3: invalid Sard date range for plan %', plan_id;
    end if;
    if route not in ('reverse_surahs_forward_ayahs', 'forward_surahs_forward_ayahs') then
      raise exception 'RC11.3: invalid Sard route';
    end if;

    select * into sp from public.smart_plans
      where id = plan_id and status = 'active' and scope_type = 'student' and student_id = sid;
    if not found then
      raise exception 'RC11.3: plan % is not an active student-scoped plan for student %', plan_id, sid;
    end if;

    select spp.id into hifz_id from public.smart_plan_phases spp
      where spp.plan_id = sp.id and spp.phase_type = 'hifz' and spp.status <> 'archived'
      order by spp.phase_order limit 1;

    select spp.id, spp.start_date into sard_id, sard_pre_start from public.smart_plan_phases spp
      where spp.plan_id = sp.id and spp.phase_type = 'sard' and spp.status <> 'archived'
      order by spp.phase_order limit 1;

    sard_done := false;

    -- the Hifz end moves up to (or past) the old Sard start: move Sard first so the two ranges never overlap in between
    if sard_id is not null and hifz_id is not null and hifz_end >= sard_pre_start then
      update public.smart_plan_phases set
        start_date = sard_start, end_date = sard_end, schedule_weekdays = weekdays,
        goal_mode = 'pages', goal_unit = 'pages', target_pages = sard_target, distribution_mode = 'flexible',
        start_mode = coalesce(nullif(start_mode, ''), 'last_sard'),
        settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{route_direction}', to_jsonb(route), true),
        updated_at = now(), revision = revision + 1
      where id = sard_id;
      sard_done := true;
    end if;

    if hifz_id is null then
      hifz_id := md5('rc113-phase:hifz:' || sp.id::text)::uuid;
      insert into public.smart_plan_phases(
        id, plan_id, phase_order, phase_type, title, start_date, end_date, schedule_weekdays, goal_mode, goal_unit,
        target_pages, distribution_mode, start_mode, allow_surplus, status, settings, created_by
      ) values (
        hifz_id, sp.id, 1, 'hifz', 'مرحلة الحفظ', hifz_start, hifz_end, sp.schedule_weekdays, 'pages', 'pages',
        coalesce(hifz_target, sp.target_pages), 'flexible', 'plan_start', true, 'active',
        jsonb_build_object('route_direction', 'reverse_surahs_forward_ayahs'), auth.uid()
      );
      prepared := prepared + 1;
    else
      update public.smart_plan_phases set
        start_date = hifz_start, end_date = hifz_end, updated_at = now(), revision = revision + 1
      where id = hifz_id;
    end if;

    if sard_id is null then
      sard_id := md5('rc113-phase:sard:' || sp.id::text)::uuid;
      insert into public.smart_plan_phases(
        id, plan_id, phase_order, phase_type, title, start_date, end_date, schedule_weekdays, goal_mode, goal_unit,
        target_pages, distribution_mode, start_mode, allow_surplus, status, settings, created_by
      ) values (
        sard_id, sp.id, 2, 'sard', 'مرحلة السرد', sard_start, sard_end, weekdays, 'pages', 'pages',
        sard_target, 'flexible', 'last_sard', true, 'active',
        jsonb_build_object('route_direction', route), auth.uid()
      );
      prepared := prepared + 1;
    elsif not sard_done then
      update public.smart_plan_phases set
        start_date = sard_start, end_date = sard_end, schedule_weekdays = weekdays,
        goal_mode = 'pages', goal_unit = 'pages', target_pages = sard_target, distribution_mode = 'flexible',
        start_mode = coalesce(nullif(start_mode, ''), 'last_sard'),
        settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{route_direction}', to_jsonb(route), true),
        updated_at = now(), revision = revision + 1
      where id = sard_id;
    end if;

    -- Parent plan is now a container spanning both phases. Preserve the student's Hifz target.
    update public.smart_plans set
      start_date = hifz_start, end_date = sard_end,
      settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{sard_route_direction}', to_jsonb(route), true),
      updated_at = now()
    where id = sp.id;

    state_id := md5('phase-state:' || hifz_id::text || ':' || sid::text)::uuid;
    if hifz_end <= current_date then
      insert into public.smart_plan_phase_states(
        id, phase_id, student_id, status, frozen_completed_pages, frozen_target_pages, completion_percent,
        carry_shortfall_pages, completed_at, updated_by, updated_at
      ) values (
        state_id, hifz_id, sid, 'completed', completed_pages, coalesce(hifz_target, sp.target_pages), pct,
        0, now(), auth.uid(), now()
      )
      on conflict (phase_id, student_id) do update set
        status = 'completed',
        frozen_completed_pages = excluded.frozen_completed_pages,
        frozen_target_pages = excluded.frozen_target_pages,
        completion_percent = excluded.completion_percent,
        completed_at = coalesce(public.smart_plan_phase_states.completed_at, excluded.completed_at),
        updated_by = auth.uid(), updated_at = now();
    else
      insert into public.smart_plan_phase_states(
        id, phase_id, student_id, status, carry_shortfall_pages, updated_by, updated_at
      ) values (
        state_id, hifz_id, sid, case when hifz_start <= current_date then 'active' else 'not_started' end,
        0, auth.uid(), now()
      )
      on conflict (phase_id, student_id) do update set
        status = case when public.smart_plan_phase_states.status = 'completed' then 'completed' else excluded.status end,
        updated_by = auth.uid(), updated_at = now();
    end if;

    sard_state := case when sard_start <= current_date then 'active' else 'not_started' end;
    state_id := md5('phase-state:' || sard_id::text || ':' || sid::text)::uuid;
    insert into public.smart_plan_phase_states(
      id, phase_id, student_id, status, target_pages_override, carry_shortfall_pages, updated_by, updated_at
    ) values (
      state_id, sard_id, sid, sard_state, null, carry, auth.uid(), now()
    )
    on conflict (phase_id, student_id) do update set
      status = case when public.smart_plan_phase_states.status = 'completed' then 'completed' else excluded.status end,
      carry_shortfall_pages = excluded.carry_shortfall_pages,
      updated_by = auth.uid(), updated_at = now();

    -- Make legacy records date-edit safe whenever ownership is unambiguous for this student plan.
    update public.recitation_entries re set phase_id = hifz_id
      from public.sessions sess
      where re.session_id = sess.id and re.student_id = sid and re.phase_id is null
        and re.activity_type::text in ('hifz', 'new_hifz')
        and sess.session_date between hifz_start and hifz_end;
    update public.recitation_entries re set phase_id = sard_id
      from public.sessions sess
      where re.session_id = sess.id and re.student_id = sid and re.phase_id is null
        and re.activity_type::text = 'sard'
        and sess.session_date between sard_start and sard_end;

    if hifz_end <= current_date then
      event_id := md5('phase-event:' || sp.id::text || ':' || sid::text || ':phase_completed:' || hifz_id::text)::uuid;
      insert into public.smart_plan_events(
        id, client_event_id, plan_id, student_id, event_type, event_date, payload, phase_id, created_by
      ) values (
        event_id, event_id, sp.id, sid, 'phase_completed', hifz_end,
        jsonb_build_object('phase_id', hifz_id, 'completed_pages', completed_pages,
          'target_pages', coalesce(hifz_target, sp.target_pages), 'completion_percent', pct),
        hifz_id, auth.uid()
      )
      on conflict (client_event_id) do nothing;
    end if;

    if sard_state = 'active' then
      event_id := md5('phase-event:' || sp.id::text || ':' || sid::text || ':phase_started:' || sard_id::text)::uuid;
      insert into public.smart_plan_events(
        id, client_event_id, plan_id, student_id, event_type, event_date, payload, phase_id, created_by
      ) values (
        event_id, event_id, sp.id, sid, 'phase_started', sard_start,
        jsonb_build_object('phase_id', sard_id, 'target_pages', sard_target, 'route_direction', route),
        sard_id, auth.uid()
      )
      on conflict (client_event_id) do nothing;
      moved := moved + 1;
    else
      scheduled := scheduled + 1;
    end if;
  end loop;

  return jsonb_build_object('rows', jsonb_array_length(p_rows), 'started', moved, 'scheduled', scheduled, 'phases_created', prepared);
end;
$function$;
