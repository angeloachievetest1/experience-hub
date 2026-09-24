-- =============================================================================
-- Experience Hub — 003: case tables for the three sections
--
-- The sections share only the lookup tables. There are no relationships
-- between Quality Analyst, Curriculum and Mentor records.
--
-- Every case table has:
--   is_sample   true for test records added during the build (easy to delete)
--   created_at / created_by / updated_at / updated_by   filled automatically
--
-- Access (row-level security):
--   Read:                 any active user
--   Create/edit/delete:   active admins who have that section assigned
-- =============================================================================

-- Fills the created/updated columns so they cannot be faked from the browser.
create or replace function private.set_row_meta()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- =============================================================================
-- Quality Analyst
-- One table for all four sources. Fields that don't apply to a source stay null.
-- =============================================================================
create table public.qa_cases (
  id                uuid primary key default gen_random_uuid(),
  source            text not null check (source in ('Instructor', 'Course', 'Survey', 'Returned')),

  -- Common fields
  case_date         date,
  customer_name     text,
  course_id         uuid references public.courses (id) on delete restrict,  -- Returned cases use qa_case_courses instead
  instructor_id     uuid references public.instructors (id) on delete restrict,
  case_link         text,             -- plain URL (Kustomer or Salesforce)
  analyst           text,
  category          text,             -- option lists qa_category_instructor / qa_category_course
  complaint_types   text[] not null default '{}',  -- multi-select; qa_type_instructor / qa_type_course
  validity          text check (validity in ('Valid', 'Partially Valid', 'Not Valid', 'N/A')),
  followup_email    text,             -- option list qa_followup_sent
  followup_sms      text,
  followup_call     text,
  customer_reached  text,             -- option list qa_reached
  resolution        text,             -- option list qa_resolution (includes "Urgent Action")
  notes             text,

  -- Instructor source
  attendance_pct    numeric(5, 2) check (attendance_pct between 0 and 100),
  participation_pct numeric(5, 2) check (participation_pct between 0 and 100),
  moodle_pct        numeric(5, 2) check (moodle_pct between 0 and 100),
  course_end_date   date,

  -- Course source
  case_closed_by    text,             -- option list qa_case_closed_by

  -- Survey source
  survey_type       text,             -- option list qa_survey_type
  survey_id         text,
  rating            smallint check (rating between 1 and 6),
  customer_comment  text,
  reason_type       text,             -- option list qa_survey_reason

  -- Returned source
  reassign_reason   text,             -- option list qa_reassign_reason

  is_sample         boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles (id) on delete set null,

  constraint qa_cases_returned_uses_course_list check (source <> 'Returned' or course_id is null)
);

create index qa_cases_case_date_idx on public.qa_cases (case_date);
create index qa_cases_source_idx on public.qa_cases (source);
create index qa_cases_course_idx on public.qa_cases (course_id);
create index qa_cases_instructor_idx on public.qa_cases (instructor_id);

create trigger qa_cases_row_meta
  before insert or update on public.qa_cases
  for each row execute function private.set_row_meta();

-- Returned cases can list several courses (the only multi-course field in the app).
create table public.qa_case_courses (
  case_id    uuid not null references public.qa_cases (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (case_id, course_id)
);

create index qa_case_courses_course_idx on public.qa_case_courses (course_id);

create or replace function private.qa_case_courses_only_returned()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.qa_cases where id = new.case_id and source = 'Returned') then
    raise exception 'Multiple courses can only be added to Returned cases.';
  end if;
  return new;
end;
$$;

create trigger qa_case_courses_only_returned
  before insert or update on public.qa_case_courses
  for each row execute function private.qa_case_courses_only_returned();

-- =============================================================================
-- Curriculum
-- =============================================================================

-- A. Customer Cases: customer complaints about course content
create table public.curriculum_customer_cases (
  id                  uuid primary key default gen_random_uuid(),
  case_date           date,
  customer_name       text,
  course_id           uuid references public.courses (id) on delete restrict,
  category            text,           -- option list cur_category
  material_type       text,           -- option list cur_material_type
  curriculum_sme      text,
  tm_on_sf            text,
  comments            text,           -- comments / complaints
  feedback_progress   text,           -- feedback / progress made
  resolution_tat_days numeric(6, 2) check (resolution_tat_days >= 0),
  date_resolved       date,
  case_resolution     text,           -- stored if present in the sheet; no features use it
  case_status_in_sf   text,           -- stored if present in the sheet; no features use it

  is_sample           boolean not null default false,
  created_at          timestamptz not null default now(),
  created_by          uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.profiles (id) on delete set null
);

create index curriculum_customer_cases_case_date_idx on public.curriculum_customer_cases (case_date);
create index curriculum_customer_cases_course_idx on public.curriculum_customer_cases (course_id);

create trigger curriculum_customer_cases_row_meta
  before insert or update on public.curriculum_customer_cases
  for each row execute function private.set_row_meta();

-- B. Instructors Cases ("Instructor requests"): instructors' and mentors' own
-- feedback about content errors. Sheet rows with a blank requester and course
-- continue the row above; they are stored as child lines (parent_id set).
create table public.curriculum_instructor_requests (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid references public.curriculum_instructor_requests (id) on delete cascade,
  line_order      integer not null default 0,   -- order of continuation lines under a parent
  requester_name  text,
  date_submitted  date,
  course_id       uuid references public.courses (id) on delete restrict,
  feedback_type   text,           -- option list cur_feedback_type
  base_material   text,           -- option list cur_base_material
  comments        text,
  status          text,           -- option list cur_request_status
  notes           text,
  date_completed  date,
  ticket_manager  text,

  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null,

  constraint curriculum_instructor_requests_not_own_parent check (parent_id is null or parent_id <> id)
);

create index curriculum_instructor_requests_parent_idx on public.curriculum_instructor_requests (parent_id, line_order);
create index curriculum_instructor_requests_date_idx on public.curriculum_instructor_requests (date_submitted);
create index curriculum_instructor_requests_course_idx on public.curriculum_instructor_requests (course_id);

create trigger curriculum_instructor_requests_row_meta
  before insert or update on public.curriculum_instructor_requests
  for each row execute function private.set_row_meta();

-- =============================================================================
-- Mentor: customer complaints about mentors
-- =============================================================================
create table public.mentor_cases (
  id                 uuid primary key default gen_random_uuid(),
  case_date          date,
  year               smallint check (year between 2000 and 2100),
  quarter            text check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  customer_name      text,
  mentor_id          uuid references public.mentors (id) on delete restrict,
  course_id          uuid references public.courses (id) on delete restrict,
  complaint_type     text,        -- option list mentor_complaint_type
  complaint_sub_type text,        -- option list mentor_complaint_sub_type
  complaint_analysis text check (complaint_analysis in ('Valid', 'Partially Valid', 'Not Valid')),
  status             text,        -- option list mentor_status
  case_closed_by     text,        -- option list mentor_case_closed_by
  email_sent         boolean,
  email_sms_preview  text,
  case_link          text,        -- plain URL

  is_sample          boolean not null default false,
  created_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id) on delete set null
);

create index mentor_cases_case_date_idx on public.mentor_cases (case_date);
create index mentor_cases_year_quarter_idx on public.mentor_cases (year, quarter);
create index mentor_cases_mentor_idx on public.mentor_cases (mentor_id);
create index mentor_cases_course_idx on public.mentor_cases (course_id);

create trigger mentor_cases_row_meta
  before insert or update on public.mentor_cases
  for each row execute function private.set_row_meta();

-- Year and quarter are stored separately; fill them from the date when left blank.
create or replace function private.mentor_cases_fill_period()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.case_date is not null then
    new.year := coalesce(new.year, extract(year from new.case_date)::smallint);
    new.quarter := coalesce(new.quarter, 'Q' || extract(quarter from new.case_date)::int);
  end if;
  return new;
end;
$$;

create trigger mentor_cases_fill_period
  before insert or update on public.mentor_cases
  for each row execute function private.mentor_cases_fill_period();

-- =============================================================================
-- Row-level security
-- =============================================================================
alter table public.qa_cases enable row level security;
alter table public.qa_case_courses enable row level security;
alter table public.curriculum_customer_cases enable row level security;
alter table public.curriculum_instructor_requests enable row level security;
alter table public.mentor_cases enable row level security;

-- Quality Analyst
create policy "Active users read QA cases" on public.qa_cases
  for select to authenticated using ((select private.is_active_user()));
create policy "QA admins add QA cases" on public.qa_cases
  for insert to authenticated with check ((select private.can_write_section('quality_analyst')));
create policy "QA admins edit QA cases" on public.qa_cases
  for update to authenticated
  using ((select private.can_write_section('quality_analyst')))
  with check ((select private.can_write_section('quality_analyst')));
create policy "QA admins delete QA cases" on public.qa_cases
  for delete to authenticated using ((select private.can_write_section('quality_analyst')));

create policy "Active users read QA case courses" on public.qa_case_courses
  for select to authenticated using ((select private.is_active_user()));
create policy "QA admins add QA case courses" on public.qa_case_courses
  for insert to authenticated with check ((select private.can_write_section('quality_analyst')));
create policy "QA admins edit QA case courses" on public.qa_case_courses
  for update to authenticated
  using ((select private.can_write_section('quality_analyst')))
  with check ((select private.can_write_section('quality_analyst')));
create policy "QA admins delete QA case courses" on public.qa_case_courses
  for delete to authenticated using ((select private.can_write_section('quality_analyst')));

-- Curriculum
create policy "Active users read curriculum customer cases" on public.curriculum_customer_cases
  for select to authenticated using ((select private.is_active_user()));
create policy "Curriculum admins add customer cases" on public.curriculum_customer_cases
  for insert to authenticated with check ((select private.can_write_section('curriculum')));
create policy "Curriculum admins edit customer cases" on public.curriculum_customer_cases
  for update to authenticated
  using ((select private.can_write_section('curriculum')))
  with check ((select private.can_write_section('curriculum')));
create policy "Curriculum admins delete customer cases" on public.curriculum_customer_cases
  for delete to authenticated using ((select private.can_write_section('curriculum')));

create policy "Active users read instructor requests" on public.curriculum_instructor_requests
  for select to authenticated using ((select private.is_active_user()));
create policy "Curriculum admins add instructor requests" on public.curriculum_instructor_requests
  for insert to authenticated with check ((select private.can_write_section('curriculum')));
create policy "Curriculum admins edit instructor requests" on public.curriculum_instructor_requests
  for update to authenticated
  using ((select private.can_write_section('curriculum')))
  with check ((select private.can_write_section('curriculum')));
create policy "Curriculum admins delete instructor requests" on public.curriculum_instructor_requests
  for delete to authenticated using ((select private.can_write_section('curriculum')));

-- Mentor
create policy "Active users read mentor cases" on public.mentor_cases
  for select to authenticated using ((select private.is_active_user()));
create policy "Mentor admins add mentor cases" on public.mentor_cases
  for insert to authenticated with check ((select private.can_write_section('mentor')));
create policy "Mentor admins edit mentor cases" on public.mentor_cases
  for update to authenticated
  using ((select private.can_write_section('mentor')))
  with check ((select private.can_write_section('mentor')));
create policy "Mentor admins delete mentor cases" on public.mentor_cases
  for delete to authenticated using ((select private.can_write_section('mentor')));

revoke all on public.qa_cases, public.qa_case_courses, public.curriculum_customer_cases,
  public.curriculum_instructor_requests, public.mentor_cases from anon;
revoke truncate, references, trigger on public.qa_cases, public.qa_case_courses,
  public.curriculum_customer_cases, public.curriculum_instructor_requests, public.mentor_cases
  from authenticated;
