-- =============================================================================
-- Experience Hub — 017: "Case type" on Mentor cases
--
-- The Mentor sheet has a "Case Type" column (Mentor Complaint / Complaint).
-- The owner asked to keep it (2026-09-30). Values come from option list
-- mentor_case_type, which can be extended.
-- =============================================================================

alter table public.mentor_cases add column case_type text;

insert into public.option_values (list_key, value, sort_order)
values ('mentor_case_type', 'Mentor Complaint', 1), ('mentor_case_type', 'Complaint', 2)
on conflict (list_key, value) do nothing;
