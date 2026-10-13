-- =============================================================================
-- Experience Hub — 026: Task Log (Quality Analyst › Operation Tasks)
--
-- One row per audited E-learning case (sheet "Case Audits: E-learning", from
-- October 2026). Same rules as the other case tables: everyone active can read,
-- only admins with the Quality Analyst section can add, edit or delete, and
-- every change goes to the Activity Log (labelled with the customer's name).
--
-- Week ending and case cycle aren't stored: the app works them out from the
-- date closed and the first touch / closed times, the same way as the sheet.
-- Dropdown fields store the option's text (lists on Case options, migration
-- 025), so renaming an option there also updates these cases.
-- =============================================================================

create table public.qa_task_cases (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text,        -- sheet: Account Name
  case_link       text,        -- sheet: Case Number (Kustomer link)
  subject         text,
  case_type       text,        -- option list qa_task_type, or typed in ("Others")
  record_type     text,        -- option list qa_task_record_type
  manager         text,        -- option list qa_task_person
  opened_at       timestamp,   -- local time, as shown in Kustomer and the sheet
  first_touch_at  timestamp,
  closed_at       timestamp,
  date_closed     date,
  handled_by      text,        -- option list qa_task_person
  no_error        boolean,
  error_type      text,        -- sheet: Error 1; option list qa_task_error, or typed in
  error_category  text,        -- sheet: Error 1 Category; option list qa_task_error_category
  auditor         text,        -- option list qa_task_auditor
  call_outs       text,
  import_ref      text unique, -- set by the spreadsheet import, so re-running it adds nothing twice

  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

create index qa_task_cases_date_closed_idx on public.qa_task_cases (date_closed);
create index qa_task_cases_handled_by_idx on public.qa_task_cases (handled_by);

create trigger qa_task_cases_row_meta
  before insert or update on public.qa_task_cases
  for each row execute function private.set_row_meta();

create trigger audit_qa_task_cases
  after insert or update or delete on public.qa_task_cases
  for each row execute function private.audit_row_change('quality_analyst');

alter table public.qa_task_cases enable row level security;

create policy "Active users read task log cases" on public.qa_task_cases
  for select to authenticated using ((select private.is_active_user()));
create policy "QA admins add task log cases" on public.qa_task_cases
  for insert to authenticated with check ((select private.can_write_section('quality_analyst')));
create policy "QA admins edit task log cases" on public.qa_task_cases
  for update to authenticated
  using ((select private.can_write_section('quality_analyst')))
  with check ((select private.can_write_section('quality_analyst')));
create policy "QA admins delete task log cases" on public.qa_task_cases
  for delete to authenticated using ((select private.can_write_section('quality_analyst')));

revoke all on public.qa_task_cases from anon;
revoke truncate, references, trigger on public.qa_task_cases from authenticated;

-- -----------------------------------------------------------------------------
-- Activity Log: name Task Log entries by customer, like the other cases.
-- -----------------------------------------------------------------------------
create or replace function private.record_label(p_table text, p_row jsonb)
returns text
language sql immutable set search_path = ''
as $$
  select case p_table
    when 'qa_cases' then coalesce(nullif(trim(p_row ->> 'customer_name'), ''), 'No customer name')
    when 'qa_task_cases' then coalesce(nullif(trim(p_row ->> 'customer_name'), ''), 'No customer name')
    when 'curriculum_customer_cases' then coalesce(nullif(trim(p_row ->> 'customer_name'), ''), 'No customer name')
    when 'mentor_cases' then coalesce(nullif(trim(p_row ->> 'customer_name'), ''), 'No customer name')
    when 'curriculum_instructor_requests' then coalesce(nullif(trim(p_row ->> 'requester_name'), ''), 'No requester')
    when 'profiles' then coalesce(nullif(p_row ->> 'full_name', ''), p_row ->> 'email')
  end;
$$;

-- -----------------------------------------------------------------------------
-- Case options: which case fields store each list's values. Same as 023 plus
-- the Task Log lists, which Case options can only change once they're listed
-- here. Keep in sync with LIST_DEFS in lib/admin/lists.ts.
-- -----------------------------------------------------------------------------
create or replace function private.case_option_fields(p_list_key text)
returns table (tbl text, col text, src text)
language sql immutable set search_path = ''
as $$
  select f.tbl, f.col, f.src from (values
    ('qa_source',                 'qa_cases', 'source',           null::text),
    ('qa_category_instructor',    'qa_cases', 'category',         'Instructor'),
    ('qa_type_instructor',        'qa_cases', 'complaint_types',  'Instructor'),
    ('qa_category_course',        'qa_cases', 'category',         'Course'),
    ('qa_type_course',            'qa_cases', 'complaint_types',  'Course'),
    ('qa_survey_type',            'qa_cases', 'survey_type',      null),
    ('qa_survey_reason',          'qa_cases', 'reason_type',      null),
    ('qa_returned_type',          'qa_cases', 'complaint_types',  'Returned'),
    ('qa_reassign_reason',        'qa_cases', 'reassign_reason',  null),
    ('qa_validity',               'qa_cases', 'validity',         null),
    ('qa_resolution',             'qa_cases', 'resolution',       null),
    ('qa_case_closed_by',         'qa_cases', 'case_closed_by',   null),
    ('qa_followup_sent',          'qa_cases', 'followup_email',   null),
    ('qa_followup_sent',          'qa_cases', 'followup_sms',     null),
    ('qa_followup_sent',          'qa_cases', 'followup_call',    null),
    ('qa_reached',                'qa_cases', 'customer_reached', null),
    ('qa_task_record_type',       'qa_task_cases', 'record_type',    null),
    ('qa_task_type',              'qa_task_cases', 'case_type',      null),
    ('qa_task_error',             'qa_task_cases', 'error_type',     null),
    ('qa_task_error_category',    'qa_task_cases', 'error_category', null),
    ('qa_task_person',            'qa_task_cases', 'manager',        null),
    ('qa_task_person',            'qa_task_cases', 'handled_by',     null),
    ('qa_task_auditor',           'qa_task_cases', 'auditor',        null),
    ('cur_category',              'curriculum_customer_cases', 'category',          null),
    ('cur_issue_type',            'curriculum_customer_cases', 'issue_type',        null),
    ('cur_material_type',         'curriculum_customer_cases', 'material_type',     null),
    ('cur_case_source',           'curriculum_customer_cases', 'case_source',       null),
    ('cur_case_resolution',       'curriculum_customer_cases', 'case_resolution',   null),
    ('cur_sf_status',             'curriculum_customer_cases', 'case_status_in_sf', null),
    ('cur_feedback_type',         'curriculum_instructor_requests', 'feedback_type', null),
    ('cur_base_material',         'curriculum_instructor_requests', 'base_material', null),
    ('cur_request_status',        'curriculum_instructor_requests', 'status',        null),
    ('mentor_complaint_type',     'mentor_cases', 'complaint_type',     null),
    ('mentor_complaint_sub_type', 'mentor_cases', 'complaint_sub_type', null),
    ('mentor_case_type',          'mentor_cases', 'case_type',          null),
    ('mentor_case_closed_by',     'mentor_cases', 'case_closed_by',     null),
    ('mentor_status',             'mentor_cases', 'status',             null),
    ('mentor_validity',           'mentor_cases', 'complaint_analysis', null)
  ) as f(list_key, tbl, col, src)
  where f.list_key = p_list_key;
$$;
