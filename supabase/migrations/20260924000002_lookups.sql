-- =============================================================================
-- Experience Hub — 002: shared lookup tables
--
--   courses        one shared list used by Quality Analyst, Curriculum and Mentor
--   instructors    master list for Quality Analyst (aliases hold spelling variants
--                  such as "Daniel Wolf" for "Daniel Wolff", used by the import)
--   mentors        people the Mentor section tracks complaints about
--   option_values  every other dropdown (categories, types, statuses ...),
--                  grouped by list_key. Add a row to extend a list.
--
-- Everyone active can read these. Only super-admins can change them.
-- =============================================================================

create table public.courses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.instructors (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null unique,
  aliases    text[] not null default '{}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.mentors (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.option_values (
  id          uuid primary key default gen_random_uuid(),
  list_key    text not null,
  value       text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (list_key, value)
);

comment on table public.option_values is
  'Dropdown values. list_key names the list (e.g. qa_survey_reason); description can hold notes such as the original sheet label.';

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------
alter table public.courses enable row level security;
alter table public.instructors enable row level security;
alter table public.mentors enable row level security;
alter table public.option_values enable row level security;

create policy "Active users read courses" on public.courses
  for select to authenticated using ((select private.is_active_user()));
create policy "Super-admins manage courses" on public.courses
  for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "Active users read instructors" on public.instructors
  for select to authenticated using ((select private.is_active_user()));
create policy "Super-admins manage instructors" on public.instructors
  for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "Active users read mentors" on public.mentors
  for select to authenticated using ((select private.is_active_user()));
create policy "Super-admins manage mentors" on public.mentors
  for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "Active users read option values" on public.option_values
  for select to authenticated using ((select private.is_active_user()));
create policy "Super-admins manage option values" on public.option_values
  for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

revoke all on public.courses, public.instructors, public.mentors, public.option_values from anon;
revoke truncate, references, trigger
  on public.courses, public.instructors, public.mentors, public.option_values from authenticated;
