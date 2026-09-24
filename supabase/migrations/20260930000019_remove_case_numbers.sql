-- =============================================================================
-- Experience Hub — 019: remove case numbers
--
-- Owner decision (2026-09-30): records are identified by customer (or
-- requester) name; the QA-0017-style numbers added in migration 007 are not
-- needed. Each record keeps its internal id. Their unique indexes are dropped
-- together with the columns.
-- =============================================================================

alter table public.qa_cases drop column case_no;
alter table public.curriculum_customer_cases drop column case_no;
alter table public.curriculum_instructor_requests drop column case_no;
alter table public.mentor_cases drop column case_no;
