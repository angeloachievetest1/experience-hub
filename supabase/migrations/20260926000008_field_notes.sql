-- =============================================================================
-- Experience Hub — 008: notes on individual fields
--
-- In the case panel, dropdown fields can carry a short note ("+ Add note"),
-- shown when hovering over "Notes". Stored per case as { field_name: note }.
-- Changes are captured by the existing audit triggers.
-- =============================================================================

alter table public.qa_cases add column field_notes jsonb not null default '{}';
alter table public.curriculum_customer_cases add column field_notes jsonb not null default '{}';
alter table public.curriculum_instructor_requests add column field_notes jsonb not null default '{}';
alter table public.mentor_cases add column field_notes jsonb not null default '{}';

alter table public.qa_cases add constraint qa_cases_field_notes_object check (jsonb_typeof(field_notes) = 'object');
alter table public.curriculum_customer_cases add constraint curriculum_customer_cases_field_notes_object check (jsonb_typeof(field_notes) = 'object');
alter table public.curriculum_instructor_requests add constraint curriculum_instructor_requests_field_notes_object check (jsonb_typeof(field_notes) = 'object');
alter table public.mentor_cases add constraint mentor_cases_field_notes_object check (jsonb_typeof(field_notes) = 'object');
