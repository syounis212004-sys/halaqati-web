-- ============================================================================
-- Halaqati Interactive Mushaf — SQL Schema Proposal (COMMENTED OUT / NOT APPLIED)
-- Status: PROPOSAL ONLY — DO NOT RUN WITHOUT EXPLICIT OWNER APPROVAL
-- Target Table: public.recitation_entries
-- Purpose: Persist per-ayah (Phase 1) and per-word (Phase 2) recitation marks
--          alongside existing `mistakes` and `prompts` integer counters.
-- ============================================================================

-- 1. Add optional JSONB column defaulting to an empty JSON array so all
--    existing queries, RPCs, offline outbox payloads, and RLS policies on
--    public.recitation_entries remain 100% backward-compatible.
--
-- ALTER TABLE public.recitation_entries
--   ADD COLUMN IF NOT EXISTS marks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Enforce basic structural integrity (must always be a JSON array).
--
-- ALTER TABLE public.recitation_entries
--   ADD CONSTRAINT recitation_entries_marks_is_array_chk
--   CHECK (jsonb_typeof(marks) = 'array');

-- 3. Optional GIN index if analytics queries later aggregate frequent error ayahs
--    per student, circle, or organization.
--
-- CREATE INDEX IF NOT EXISTS idx_recitation_entries_marks_gin
--   ON public.recitation_entries
--   USING gin (marks jsonb_path_ops);

-- 4. Expected element shape inside `marks`:
--    [
--      {
--        "ayah_key": "2:255",
--        "word": null,           -- Phase 1: null (ayah-level); Phase 2: 1-based word index
--        "type": "mistake",      -- "mistake" | "prompt" | "tajweed"
--        "at": 1732195200000     -- Unix timestamp in milliseconds
--      }
--    ]

-- 5. RLS & Offline Sync Notes:
--    - Inherits existing Row-Level Security policies on public.recitation_entries
--      (no new tables or policy changes required).
--    - When approved, include `marks` in `#reportForm` submit payload and in
--      `saveReportOffline()` / `src/features/rc27/phases.js` outbox queue.

-- 6. Rollback (if ever needed):
--
-- DROP INDEX IF EXISTS public.idx_recitation_entries_marks_gin;
-- ALTER TABLE public.recitation_entries DROP CONSTRAINT IF EXISTS recitation_entries_marks_is_array_chk;
-- ALTER TABLE public.recitation_entries DROP COLUMN IF EXISTS marks;
