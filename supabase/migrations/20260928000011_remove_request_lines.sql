-- =============================================================================
-- Experience Hub — 011: no continuation lines for Instructor requests
--
-- Owner decision (2026-09-28): every sheet row is its own request. Rows with a
-- blank requester or course stay blank; they are not attached to the row above.
-- This replaces the "child lines" approach from the original brief (section 6B).
-- =============================================================================

-- Sample continuation lines only existed for testing.
delete from public.curriculum_instructor_requests where parent_id is not null and is_sample;

-- Any other line becomes a request of its own (keeps its data).
update public.curriculum_instructor_requests set parent_id = null where parent_id is not null;

drop index if exists public.curriculum_instructor_requests_parent_idx;
alter table public.curriculum_instructor_requests drop constraint if exists curriculum_instructor_requests_not_own_parent;
alter table public.curriculum_instructor_requests drop column parent_id;
alter table public.curriculum_instructor_requests drop column line_order;
