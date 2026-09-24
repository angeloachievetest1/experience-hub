-- =============================================================================
-- Experience Hub — 009: full names for survey types
--
-- option_values.description now holds what each survey code means; the app
-- shows it next to the code. The original sheet labels (FCS, ECF, MCF, PEF,
-- Post Tutoring) are mapped in the Phase 4 import script instead.
-- =============================================================================

update public.option_values set description = d.full_name
from (values
  ('AFCS', 'After First Class Survey'),
  ('ECS',  'End Course Survey'),
  ('MCS',  'Mid Course Survey'),
  ('PES',  'Post Exam Survey'),
  ('PTS',  'Post Tutoring Survey')
) as d (value, full_name)
where option_values.list_key = 'qa_survey_type' and option_values.value = d.value;
