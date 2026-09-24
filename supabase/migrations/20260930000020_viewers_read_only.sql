-- =============================================================================
-- Experience Hub — 020: Viewers are view-only, with no exceptions
--
-- Owner decision (2026-09-30): a Viewer can't edit anything and can't be a
-- super-admin. Sections and the super-admin flag only apply to Admins.
-- (Replaces the brief's "super-admin flag independent of role".)
-- Admins edit only their ticked sections and view the others (unchanged,
-- enforced by the section policies from migration 003).
-- =============================================================================

update public.profiles set sections = '{}', is_super_admin = false
where role = 'viewer' and (sections <> '{}' or is_super_admin);

alter table public.profiles add constraint profiles_viewer_read_only
  check (role = 'admin' or (sections = '{}' and not is_super_admin));

-- New users from the Admin Dashboard: sections and super-admin only for Admins.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_approved boolean := coalesce(v_meta ->> 'eh_approved', '') = 'true';
  v_role     text := case when v_approved and v_meta ->> 'eh_role' in ('viewer', 'admin') then v_meta ->> 'eh_role' else 'viewer' end;
  v_sections text[] := case
    when v_role = 'admin' and jsonb_typeof(v_meta -> 'eh_sections') = 'array'
      then array(select jsonb_array_elements_text(v_meta -> 'eh_sections')
                 intersect select unnest(array['quality_analyst', 'curriculum', 'mentor']))
    else '{}'::text[] end;
begin
  insert into public.profiles (id, email, full_name, department, role, sections, is_super_admin, status, deactivation_note)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'department', ''),
    v_role,
    coalesce(v_sections, '{}'),
    v_role = 'admin' and coalesce(v_meta ->> 'eh_super_admin', '') = 'true',
    case when v_approved then 'active' else 'deactivated' end,
    case when v_approved then null else 'New account, waiting for a super-admin to activate it' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
