-- =============================================================================
-- Experience Hub — 014: extra course requested by the owner
--
-- The Returned Cases sheet lists "Allegany College of Maryland" as a course.
-- The owner asked for it to be added as "Allegany College of Maryland
-- Entrance Exam Prep" (2026-09-30). The import maps the sheet value to it.
-- =============================================================================

insert into public.courses (name, sort_order)
values ('Allegany College of Maryland Entrance Exam Prep', 32)
on conflict (name) do nothing;
