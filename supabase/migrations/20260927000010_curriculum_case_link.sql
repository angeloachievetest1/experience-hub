-- =============================================================================
-- Experience Hub — 010: case link for Curriculum customer cases
--
-- Every case log has a one-click "Link" column. Curriculum customer cases had
-- no link field in the sheet; this adds an optional one (plain URL).
-- =============================================================================

alter table public.curriculum_customer_cases add column case_link text;
