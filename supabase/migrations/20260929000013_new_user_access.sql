-- =============================================================================
-- Experience Hub — 013: set a new user's access when the account is created
--
-- The Admin Dashboard creates users with the secret key and passes their role,
-- sections and super-admin flag in app_metadata (only server code with the
-- secret key can set app_metadata, so it can be trusted). The profile is then
-- created complete, in one step, with one "Created a user" log entry.
-- =============================================================================

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_approved boolean := coalesce(v_meta ->> 'eh_approved', '') = 'true';
  v_role     text := case when v_approved and v_meta ->> 'eh_role' in ('viewer', 'admin') then v_meta ->> 'eh_role' else 'viewer' end;
  v_sections text[] := case
    when v_approved and jsonb_typeof(v_meta -> 'eh_sections') = 'array'
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
    v_approved and coalesce(v_meta ->> 'eh_super_admin', '') = 'true',
    case when v_approved then 'active' else 'deactivated' end,
    case when v_approved then null else 'New account, waiting for a super-admin to activate it' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
