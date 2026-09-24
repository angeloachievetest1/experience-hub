-- =============================================================================
-- Experience Hub — 001: user profiles and access helpers
--
-- Every signed-in person has one row in public.profiles (created automatically
-- when a Supabase Auth user is created). Access rules for the whole app are
-- built on three helper functions defined here:
--   private.is_active_user()          -> signed in AND status = 'active'
--   private.is_super_admin()          -> active AND super-admin flag
--   private.can_write_section(text)   -> active AND role 'admin' AND section assigned
-- =============================================================================

-- Functions that must not be callable through the public API live here.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- Nothing in this app is meant for signed-out visitors, and TRUNCATE bypasses
-- row-level security, so remove both from tables created from now on.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text not null default '',
  department        text,
  role              text not null default 'viewer'
                      check (role in ('viewer', 'admin')),
  sections          text[] not null default '{}'
                      check (sections <@ array['quality_analyst', 'curriculum', 'mentor']::text[]),
  is_super_admin    boolean not null default false,
  status            text not null default 'active'
                      check (status in ('active', 'deactivated')),
  deactivation_note text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.profiles.role is 'viewer = read only; admin = can edit cases in the assigned sections';
comment on column public.profiles.sections is 'Sections an admin may edit: quality_analyst, curriculum, mentor';
comment on column public.profiles.is_super_admin is 'Opens the Admin Dashboard; independent of role and sections';
comment on column public.profiles.deactivation_note is 'Optional free text, e.g. on leave, resigned, terminated, other';

-- -----------------------------------------------------------------------------
-- Access helpers (security definer so they can read profiles without
-- recursing into the profiles RLS policies)
-- -----------------------------------------------------------------------------
create or replace function private.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active'
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active' and is_super_admin
  );
$$;

create or replace function private.can_write_section(p_section text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and status = 'active'
      and role = 'admin'
      and p_section = any (sections)
  );
$$;

revoke all on function private.is_active_user() from public;
revoke all on function private.is_super_admin() from public;
revoke all on function private.can_write_section(text) from public;
grant execute on function private.is_active_user() to authenticated, service_role;
grant execute on function private.is_super_admin() to authenticated, service_role;
grant execute on function private.can_write_section(text) to authenticated, service_role;

-- Shared trigger: keep updated_at current.
create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Keep profiles in step with Supabase Auth users
--
-- Secure by default: a new account starts deactivated unless it was created by
-- trusted server code that set app_metadata.eh_approved = true (the Admin
-- Dashboard does this from Phase 4). Accounts made any other way — the Supabase
-- dashboard, or someone calling the public sign-up API — can read nothing
-- until a super-admin activates them.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_approved boolean := coalesce(new.raw_app_meta_data ->> 'eh_approved', '') = 'true';
begin
  insert into public.profiles (id, email, full_name, status, deactivation_note)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when v_approved then 'active' else 'deactivated' end,
    case when v_approved then null else 'New account, waiting for a super-admin to activate it' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.handle_auth_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_auth_email_change();

-- Accounts created before this migration ran also get a (not yet active) profile.
insert into public.profiles (id, email, full_name, status, deactivation_note)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', ''),
       'deactivated', 'New account, waiting for a super-admin to activate it'
from auth.users
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Safety: never remove or deactivate the last active super-admin
-- -----------------------------------------------------------------------------
create or replace function private.protect_last_super_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_super_admin and old.status = 'active'
     and (tg_op = 'DELETE' or not new.is_super_admin or new.status <> 'active')
     and not exists (
       select 1 from public.profiles
       where id <> old.id and is_super_admin and status = 'active'
     )
  then
    raise exception 'At least one active super-admin is required. Give another user the super-admin flag first.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_protect_last_super_admin
  before update or delete on public.profiles
  for each row execute function private.protect_last_super_admin();

-- -----------------------------------------------------------------------------
-- Deactivation blocks sign-in: ban the Auth user and end their sessions.
-- Reactivation lifts the ban.
-- -----------------------------------------------------------------------------
create or replace function private.sync_auth_ban()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'deactivated' then
    update auth.users set banned_until = now() + interval '100 years' where id = new.id;
    delete from auth.sessions where user_id = new.id;
  else
    update auth.users set banned_until = null where id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_sync_auth_ban
  after update of status on public.profiles
  for each row
  when (old.status is distinct from new.status)
  execute function private.sync_auth_ban();

-- -----------------------------------------------------------------------------
-- Row-level security
--   Read:   your own profile; super-admins read everyone.
--   Update: super-admins only, and only the editable columns below.
--   Insert/delete: never through the app (Auth trigger / server code only).
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Read own profile, super-admins read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_super_admin()));

create policy "Super-admins update profiles"
  on public.profiles for update to authenticated
  using ((select private.is_super_admin()))
  with check ((select private.is_super_admin()));

revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, department, role, sections, is_super_admin, status, deactivation_note)
  on public.profiles to authenticated;
