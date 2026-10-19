-- Halaqati v2.19.1 — Performance Hotfix
-- Safe, idempotent indexes for the high-frequency student/session lookups.
-- Run once in Supabase SQL Editor before/after deploying v2.19.1.

create index if not exists recitation_entries_session_student_idx
  on public.recitation_entries (session_id, student_id);

create index if not exists recitation_entries_student_created_idx
  on public.recitation_entries (student_id, created_at desc);

create index if not exists attendance_records_student_idx
  on public.attendance_records (student_id);

create index if not exists student_daily_notes_student_idx
  on public.student_daily_notes (student_id);

create index if not exists student_goals_student_period_idx
  on public.student_goals (student_id, period_start, period_end);

-- Existing smart_plans indexes are intentionally left unchanged.
-- RLS policy rewrites are not included in this hotfix to avoid changing authorization behavior.
