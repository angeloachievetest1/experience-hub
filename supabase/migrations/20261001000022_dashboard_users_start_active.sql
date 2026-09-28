-- =============================================================================
-- Experience Hub — 022: users created on the Admin Dashboard start active
--
-- Bug: Supabase Auth creates the account first and attaches app_metadata
-- (eh_approved, eh_role, ...) in a separate UPDATE a moment later. The insert
-- trigger (013/020) therefore never saw the approval, so every dashboard-created
-- user started as a deactivated Viewer and had to be fixed by hand.
--
-- Fix: when eh_approved arrives on an account that is still waiting, give it the
-- chosen role, sections and super-admin flag and make it active. Accounts made
-- any other way (no eh_approved) still start deactivated, as before.
-- The "Created a user" log entry is rewritten to show the account as created,
-- so the log keeps one entry per new user.
-- =============================================================================

create or replace function private.apply_dashboard_approval()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_role     text := case when v_meta ->> 'eh_role' in ('viewer', 'admin') then v_meta ->> 'eh_role' else 'viewer' end;
  v_sections text[] := case
    when v_role = 'admin' and jsonb_typeof(v_meta -> 'eh_sections') = 'array'
      then array(select jsonb_array_elements_text(v_meta -> 'eh_sections')
                 intersect select unnest(array['quality_analyst', 'curriculum', 'mentor']))
    else '{}'::text[] end;
  v_skip     text := coalesce(current_setting('app.skip_audit', true), '');
  v_updated  int;
  v_profile  jsonb;
begin
  if coalesce(v_meta ->> 'eh_approved', '') <> 'true'
     or coalesce(old.raw_app_meta_data ->> 'eh_approved', '') = 'true' then
    return null;
  end if;

  perform set_config('app.skip_audit', 'on', true);
  update public.profiles
  set role = v_role,
      sections = coalesce(v_sections, '{}'),
      is_super_admin = v_role = 'admin' and coalesce(v_meta ->> 'eh_super_admin', '') = 'true',
      status = 'active',
      deactivation_note = null
  where id = new.id
    and status = 'deactivated'
    and deactivation_note = 'New account, waiting for a super-admin to activate it';
  get diagnostics v_updated = row_count;
  perform set_config('app.skip_audit', v_skip, true);

  if v_updated = 0 then
    return null;
  end if;

  -- Same shape the audit trigger writes for a new row: every filled-in field, before = null.
  select to_jsonb(p) into v_profile from public.profiles p where p.id = new.id;
  update public.activity_log
  set changes = (
    select coalesce(jsonb_object_agg(k, jsonb_build_object('before', null, 'after', v_profile -> k)), '{}'::jsonb)
    from jsonb_object_keys(v_profile) as k
    where not (k = any (array['id', 'created_at', 'created_by', 'updated_at', 'updated_by']))
      and coalesce(v_profile -> k, 'null'::jsonb) not in ('null'::jsonb, '[]'::jsonb, '""'::jsonb, '{}'::jsonb))
  where id = (
    select id from public.activity_log
    where record_id = new.id::text and action = 'Created a user'
    order by id desc limit 1
  );
  return null;
end;
$$;

create trigger on_auth_user_approved
  after update of raw_app_meta_data on auth.users
  for each row execute function private.apply_dashboard_approval();

-- Tidy-up: users who were activated by hand still carry the "waiting" note.
set local app.skip_audit = 'on';
update public.profiles
set deactivation_note = null
where status = 'active'
  and deactivation_note = 'New account, waiting for a super-admin to activate it';
