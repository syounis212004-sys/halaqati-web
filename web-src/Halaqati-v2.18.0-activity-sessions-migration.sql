-- Halaqati v2.18.0 — structured educational/interactive sessions.
-- Additive only: no existing rows are changed or deleted.

alter table public.sessions
  add column if not exists activity_data jsonb not null default '{}'::jsonb;

alter table public.student_daily_notes
  add column if not exists activity_score numeric(8,2),
  add column if not exists activity_max_score numeric(8,2),
  add column if not exists participation text;

comment on column public.sessions.activity_data is
  'Optional structured metadata for lesson/interactive sessions: activity type, weekly value, quiz settings, recurrence, summary.';
comment on column public.student_daily_notes.activity_score is
  'Optional activity/quiz score, separate from Quran recitation points.';
comment on column public.student_daily_notes.activity_max_score is
  'Maximum score for the educational activity/quiz.';
comment on column public.student_daily_notes.participation is
  'Participation label for educational/interactive sessions.';
