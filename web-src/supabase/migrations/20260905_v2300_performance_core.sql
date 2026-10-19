-- Halaqati v2.30.0 — Performance Core
-- Safe, idempotent indexes only. Authorization/RLS semantics are intentionally unchanged.
-- Run once in Supabase SQL Editor before or after deploying v2.30.0.

-- Guardian reverse lookup is used by RLS and guardian screens.
create index if not exists student_guardians_guardian_id_idx
  on public.student_guardians (guardian_id, student_id);

-- Core session list is ordered and filtered by date on every refresh.
create index if not exists sessions_session_date_idx
  on public.sessions (session_date desc, halaqa_id);

-- Operational history is commonly filtered by student then displayed newest-first.
create index if not exists attendance_records_student_recorded_idx
  on public.attendance_records (student_id, recorded_at desc);

create index if not exists student_daily_notes_student_created_idx
  on public.student_daily_notes (student_id, created_at desc);

-- No RLS policy/function rewrite in v2.30.0: security behavior stays byte-for-byte compatible
-- with the existing authorization model. Supabase Performance Advisor findings can be handled
-- in a later, separately-tested database-security phase.
