-- =============================================================================
-- Experience Hub — 006: seed lookup lists
--
-- Safe to re-run: existing values are left alone.
-- Instructors are NOT seeded here: the master list will be supplied as
-- /data/instructors.csv and loaded in Phase 4.
-- People lists (QA analysts, Curriculum SMEs, ticket managers) are also left
-- empty until the real names come from the sheet exports.
-- =============================================================================

insert into public.courses (name, sort_order)
select name, ord::int
from unnest(array[
  'American Government',
  'Art of the Western World',
  'Biology',
  'Career Guidance',
  'Chemistry',
  'College Algebra',
  'College Composition',
  'College Composition (with modular)',
  'College Mathematics',
  'Dental Hygiene Entrance Exam Prep',
  'ESL Health',
  'Ethics in America',
  'Fundamentals of Math',
  'History of the United States 1',
  'Human Growth and Development',
  'Humanities',
  'Introduction to Psychology',
  'Macroeconomics',
  'Microeconomics',
  'National Board of Dental Hygienist Examination',
  'Next Gen NCLEX PN Prep',
  'Next Gen NCLEX RN Prep',
  'Nursing Entrance Exam Prep',
  'SAT/ACT Prep',
  'Sociology',
  'Spanish 1',
  'Spanish 2',
  'Speech',
  'Statistics',
  'World Religions',
  'ATI TEAS'
]) with ordinality as t (name, ord)
on conflict (name) do nothing;

insert into public.mentors (full_name)
values
  ('Diana Saad'),
  ('Ifrah Naaz'),
  ('Ivana Panajotov'),
  ('Kelly Lawson'),
  ('Mira Zarrouf'),
  ('Tamaryn Du Preez'),
  ('Tonya Clarke'),
  ('Winfred Miano')
on conflict (full_name) do nothing;

-- -----------------------------------------------------------------------------
-- Dropdown lists. Values marked "(prototype)" come from the approved design
-- prototype rather than the brief; adjust freely.
-- -----------------------------------------------------------------------------
with lists (list_key, vals) as (
  values
    -- Quality Analyst
    ('qa_source',              array['Instructor', 'Course', 'Survey', 'Returned']),
    ('qa_validity',            array['Valid', 'Partially Valid', 'Not Valid', 'N/A']),
    ('qa_category_instructor', array['Instructor Performance', 'Customer Experience']),
    ('qa_category_course',     array['Customer Experience', 'Course & Preferences']),
    ('qa_type_instructor',     array['Accent', 'Pace', 'Teaching Style', 'Professionalism', 'Lesson organization', 'Connectivity Issues']),
    ('qa_type_course',         array['Course Cancellation', 'Course Extension', 'Tutoring Concerns', 'Connectivity Issues', 'Class Notifications', 'Book', 'Course Resources']),
    ('qa_survey_type',         array['AFCS', 'ECS', 'MCS', 'PES', 'PTS']),
    ('qa_survey_reason',       array['Not Reached', 'Study Concern', 'Instructor Related', 'Good Comment/Low Score - Mistake', 'Exam Content - Course Content Mismatch', 'Tech Issues', 'Customer Personal Issues', 'Internal Process', 'Moodle Concern', 'Exam Experience', 'Pacing/Timing Related']),
    ('qa_followup_sent',       array['Yes', 'No', 'Not Required', 'N/A']),                 -- (prototype)
    ('qa_reached',             array['Reached', 'Not Reached', 'N/A']),                    -- (prototype)
    ('qa_case_closed_by',      array['Customer Success', 'eLearning Operation', 'N/A']),  -- (prototype)
    ('qa_reassign_reason',     array['Not eLearning''s Scope', 'Duplicate Case - Investigation was already done before', 'Lack of Information']),  -- (prototype, from sheet)
    ('qa_resolution',          array['Addressed with Instructor', 'Not enough info, no response from cx', 'N/A for eLearning', 'Urgent Action', 'Customer declined all resolutions offered']),  -- (prototype)
    -- Curriculum
    ('cur_category',           array['Social Science', 'Humanities', 'Nursing Exam', 'Dental Exam', 'Language', 'Mathematics']),
    ('cur_material_type',      array['Achieve Material', 'Exam Content Complaint', 'Exam Content Mismatch', 'Moodle Content', 'Content/Slides', 'Portal', 'Course Content', 'Practice exam', 'Quizzes', 'Slides', 'Assignment', 'Syllabus', 'Study guide/ebook', 'Lesson', 'Flashcards', 'Insufficient content', 'Mismatch']),  -- (prototype + brief)
    ('cur_feedback_type',      array['Instructor Feedback', 'Mentoring Feedback', 'Cx Feedback']),
    ('cur_base_material',      array['Slides', 'Moodle', 'Moodle Quiz', 'Study Guide', 'Infographics', 'Practice Exam', 'Comprehensive Test', 'Multiple (SG, slides, etc.)', 'Other']),  -- (prototype)
    ('cur_request_status',     array['Complete', 'In Progress', 'Not Started', 'Not Required']),
    -- Mentor
    ('mentor_complaint_type',     array['Course', 'Mentor', 'Feedback']),
    ('mentor_complaint_sub_type', array['Accent', 'Cancellation', 'Communication', 'Connectivity Issues', 'Course', 'Course Extension', 'Lesson organization', 'Other/Add comment', 'Pace', 'Professionalism', 'Session Duration', 'Teaching Style', 'Unresponsive']),
    ('mentor_validity',           array['Valid', 'Partially Valid', 'Not Valid']),
    ('mentor_status',             array['New', 'In-progress', 'Closed']),
    ('mentor_case_closed_by',     array['Curriculum', 'Customer Success', 'eLearning Operation', 'Mentor Coordinator'])
)
insert into public.option_values (list_key, value, sort_order)
select l.list_key, v.value, v.ord::int
from lists l
cross join lateral unnest(l.vals) with ordinality as v (value, ord)
on conflict (list_key, value) do nothing;

-- Survey types: keep the original sheet label for the import.
update public.option_values set description = 'Sheet label: ' || d.label
from (values ('AFCS', 'FCS'), ('ECS', 'ECF'), ('MCS', 'MCF'), ('PES', 'PEF'), ('PTS', 'Post Tutoring')) as d (value, label)
where list_key = 'qa_survey_type' and option_values.value = d.value and description is null;
