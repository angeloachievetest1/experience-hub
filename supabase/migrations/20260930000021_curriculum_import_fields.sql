-- =============================================================================
-- Experience Hub — 021: Curriculum fields kept from the owner's sheet
--
-- Owner decisions (2026-09-30) for the Curriculum import:
--   * keep the sheet's "Type" (Exam Content Mismatch, Moodle Content, ...) and
--     "Source of case" (Salesforce, Kustomer, ...) as fields
--   * show Case Resolution and Case Status in SF (the brief assumed they were
--     always blank; 121 rows have values)
--   * add "Science" to the Curriculum categories
--   * add the course "Spanish 1 & 2" for cases that just say "Spanish"
-- =============================================================================

alter table public.curriculum_customer_cases add column issue_type text;   -- sheet column "Type"
alter table public.curriculum_customer_cases add column case_source text;  -- sheet column "Source of case"

insert into public.option_values (list_key, value, sort_order)
values
  ('cur_category', 'Science', 7),
  ('cur_case_source', 'Salesforce', 1), ('cur_case_source', 'Kustomer', 2),
  ('cur_case_source', 'eLearning Ops', 3), ('cur_case_source', 'CS', 4),
  ('cur_case_resolution', 'Complete', 1), ('cur_case_resolution', 'In Progress', 2),
  ('cur_sf_status', 'In Progress', 1), ('cur_sf_status', 'Complete', 2)
on conflict (list_key, value) do nothing;

insert into public.courses (name, sort_order)
values ('Spanish 1 & 2', 37)
on conflict (name) do nothing;
