-- =============================================================================
-- Experience Hub — 007: readable case numbers, sample flags, known data gaps
-- =============================================================================

-- Short numbers people can quote ("QA-0012") instead of the internal id.
alter table public.qa_cases add column case_no bigint generated always as identity;
alter table public.curriculum_customer_cases add column case_no bigint generated always as identity;
alter table public.curriculum_instructor_requests add column case_no bigint generated always as identity;
alter table public.mentor_cases add column case_no bigint generated always as identity;

create unique index qa_cases_case_no_idx on public.qa_cases (case_no);
create unique index curriculum_customer_cases_case_no_idx on public.curriculum_customer_cases (case_no);
create unique index curriculum_instructor_requests_case_no_idx on public.curriculum_instructor_requests (case_no);
create unique index mentor_cases_case_no_idx on public.mentor_cases (case_no);

-- Test instructors used by the sample records (removed with them in Phase 4).
alter table public.instructors add column is_sample boolean not null default false;

-- -----------------------------------------------------------------------------
-- Known gaps in the historical data. Charts show these months as "no data"
-- instead of zero. Months are stored as the first day of the month.
-- -----------------------------------------------------------------------------
create table public.qa_data_gaps (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('Instructor', 'Course', 'Survey', 'Returned')),
  start_month date not null,
  end_month   date not null,
  note        text,
  created_at  timestamptz not null default now(),
  check (end_month >= start_month),
  check (extract(day from start_month) = 1 and extract(day from end_month) = 1)
);

insert into public.qa_data_gaps (source, start_month, end_month, note)
values ('Course', '2025-07-01', '2026-01-01', 'The Course Complaints sheet has no rows from July 2025 to January 2026.');

alter table public.qa_data_gaps enable row level security;

create policy "Active users read data gaps" on public.qa_data_gaps
  for select to authenticated using ((select private.is_active_user()));
create policy "Super-admins manage data gaps" on public.qa_data_gaps
  for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

revoke all on public.qa_data_gaps from anon;
revoke truncate, references, trigger on public.qa_data_gaps from authenticated;
