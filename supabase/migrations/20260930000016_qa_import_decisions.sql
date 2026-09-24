-- =============================================================================
-- Experience Hub — 016: owner decisions from the Quality Analyst import review
-- (2026-09-30)
--
--   * Four course names from the sheet are added as courses.
--   * No artificial data gap: the dashboard shows exactly what the Course
--     Complaints tab contains (the sheet has rows inside Jul 2025 – Jan 2026,
--     so the gap from the brief no longer applies).
-- =============================================================================

insert into public.courses (name, sort_order)
values
  ('HESI Mobility/Challenge Prep', 33),
  ('ODT Anatomy & Physiology 1', 34),
  ('Tutoring - Chemistry', 35),
  ('ODT Eng Composition', 36)
on conflict (name) do nothing;

delete from public.qa_data_gaps where source = 'Course' and start_month = '2025-07-01' and end_month = '2026-01-01';
