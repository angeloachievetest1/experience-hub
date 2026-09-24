-- =============================================================================
-- Experience Hub — 015: one-time spreadsheet import support
--
--   import_ref   where an imported row came from, e.g. "qa.xlsx / Instructor
--                Complaints / row 12". Lets the import be re-run safely (it
--                replaces its own rows only) and makes every row traceable.
--   qa_returned_type   "Complaint type" of Returned cases (Portal, Instructor,
--                Exam), stored in complaint_types like the other sources.
-- =============================================================================

alter table public.qa_cases add column import_ref text;
alter table public.curriculum_customer_cases add column import_ref text;
alter table public.curriculum_instructor_requests add column import_ref text;
alter table public.mentor_cases add column import_ref text;

create unique index qa_cases_import_ref_idx on public.qa_cases (import_ref);
create unique index curriculum_customer_cases_import_ref_idx on public.curriculum_customer_cases (import_ref);
create unique index curriculum_instructor_requests_import_ref_idx on public.curriculum_instructor_requests (import_ref);
create unique index mentor_cases_import_ref_idx on public.mentor_cases (import_ref);

insert into public.option_values (list_key, value, sort_order)
values ('qa_returned_type', 'Portal', 1), ('qa_returned_type', 'Instructor', 2), ('qa_returned_type', 'Exam', 3)
on conflict (list_key, value) do nothing;
