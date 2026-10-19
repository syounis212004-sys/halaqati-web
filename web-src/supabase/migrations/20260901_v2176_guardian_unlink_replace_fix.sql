-- Halaqati v2.17.6 — guardian unlink/replace privacy fix
-- Applied to production on 2026-09-01. Included here for reproducible source history.

create or replace function public.set_student_primary_guardian(
  p_student_id uuid,
  p_guardian_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  g public.profiles%rowtype;
begin
  if not public.can_administer_student(p_student_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  if p_guardian_id is null then
    delete from public.student_guardians
    where student_id = p_student_id;

    update public.students
    set guardian_email = null
    where id = p_student_id;

    return;
  end if;

  select * into g
  from public.profiles
  where id = p_guardian_id
    and role = 'guardian'::public.app_role
    and approval_status = 'approved'
    and active = true;

  if not found then
    raise exception 'guardian account is not approved or active' using errcode='22023';
  end if;

  delete from public.student_guardians
  where student_id = p_student_id
    and guardian_id is distinct from p_guardian_id;

  insert into public.student_guardians(student_id, guardian_id, relation, is_primary)
  values(p_student_id, p_guardian_id, 'ولي أمر', true)
  on conflict(student_id, guardian_id)
  do update set is_primary = true, relation = 'ولي أمر';

  update public.students
  set guardian_email = g.email,
      guardian_phone = coalesce(g.phone, guardian_phone)
  where id = p_student_id;
end;
$function$;
