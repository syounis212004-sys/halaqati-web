-- Halaqati v2.14.1: server change stamps used by offline master-data conflict detection.
alter table public.halaqas
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.halaqati_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists halaqas_set_updated_at on public.halaqas;
create trigger halaqas_set_updated_at
before update on public.halaqas
for each row execute function public.halaqati_set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.halaqati_set_updated_at();

drop trigger if exists student_categories_set_updated_at on public.student_categories;
create trigger student_categories_set_updated_at
before update on public.student_categories
for each row execute function public.halaqati_set_updated_at();

create index if not exists halaqas_updated_at_idx on public.halaqas(updated_at);
create index if not exists students_updated_at_idx on public.students(updated_at);
create index if not exists student_categories_updated_at_idx on public.student_categories(updated_at);
