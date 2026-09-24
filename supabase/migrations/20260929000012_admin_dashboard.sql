-- =============================================================================
-- Experience Hub — 012: support for the Admin Dashboard
--
--   * activity_log.record_label: readable name of the record (QA-0017, Jane Doe)
--   * audit triggers can be skipped for the one-time import
--     (set local app.skip_audit = 'on'), so history rows don't flood the log
--   * admin_log_event(): super-admins record actions that have no table
--     trigger (e.g. "Set a new password")
--   * admin_claim_event(): user creation/deletion runs through Supabase Auth
--     with the service key, so the trigger can't see who did it; the Admin
--     Dashboard then attaches the super-admin's name to that log row
-- =============================================================================

alter table public.activity_log add column record_label text;

create or replace function private.record_label(p_table text, p_row jsonb)
returns text
language sql immutable set search_path = ''
as $$
  select case p_table
    when 'qa_cases' then 'QA-' || lpad(p_row ->> 'case_no', 4, '0')
    when 'curriculum_customer_cases' then 'CUR-' || lpad(p_row ->> 'case_no', 4, '0')
    when 'curriculum_instructor_requests' then 'REQ-' || lpad(p_row ->> 'case_no', 4, '0')
    when 'mentor_cases' then 'MEN-' || lpad(p_row ->> 'case_no', 4, '0')
    when 'profiles' then coalesce(nullif(p_row ->> 'full_name', ''), p_row ->> 'email')
  end;
$$;

-- Same as migration 004, plus the label and the import switch.
create or replace function private.audit_row_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_scope       text := tg_argv[0];
  v_old         jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new         jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row         jsonb := coalesce(v_new, v_old);
  v_ignored     text[] := array['id', 'created_at', 'created_by', 'updated_at', 'updated_by'];
  v_changes     jsonb;
  v_fields      text[];
  v_action      text;
  v_summary     text;
  v_actor       uuid := auth.uid();
  v_actor_name  text;
  v_actor_email text;
begin
  if current_setting('app.skip_audit', true) = 'on' then
    return null;
  end if;

  select coalesce(jsonb_object_agg(k, jsonb_build_object('before', v_old -> k, 'after', v_new -> k)), '{}'::jsonb),
         coalesce(array_agg(k order by k), '{}')
    into v_changes, v_fields
  from jsonb_object_keys(v_row) as k
  where not (k = any (v_ignored))
    and (v_old -> k) is distinct from (v_new -> k)
    and (tg_op = 'UPDATE' or coalesce(v_row -> k, 'null'::jsonb) not in ('null'::jsonb, '[]'::jsonb, '""'::jsonb, '{}'::jsonb));

  if tg_op = 'UPDATE' and cardinality(v_fields) = 0 then
    return null;
  end if;

  if v_scope = 'users' then
    v_action := case tg_op
      when 'INSERT' then 'Created a user'
      when 'DELETE' then 'Deleted a user'
      else case
        when 'status' = any (v_fields) then
          case when v_new ->> 'status' = 'deactivated' then 'Deactivated a user' else 'Reactivated a user' end
        when 'role' = any (v_fields) then 'Changed a role'
        when 'sections' = any (v_fields) or 'is_super_admin' = any (v_fields) then 'Changed permissions'
        else 'Edited a user'
      end
    end;
    v_summary := case when tg_op = 'UPDATE'
      then 'Changed ' || (select string_agg(initcap(replace(f, '_', ' ')), ', ') from unnest(v_fields) as f)
    end;
  else
    v_action := case tg_op
      when 'INSERT' then 'Added a case'
      when 'UPDATE' then 'Edited a case'
      else 'Deleted a case'
    end;
    if tg_op = 'UPDATE' then
      select 'Changed ' || string_agg(initcap(replace(f, '_', ' ')), ', ') into v_summary
      from unnest(v_fields) as f;
    end if;
  end if;

  if v_actor is not null then
    select full_name, email into v_actor_name, v_actor_email
    from public.profiles where id = v_actor;
  end if;

  insert into public.activity_log
    (actor_id, actor_name, actor_email, section, action, record_type, record_id, record_label, summary, changes)
  values
    (v_actor, v_actor_name, v_actor_email, nullif(v_scope, 'users'), v_action,
     tg_table_name, v_row ->> 'id', private.record_label(tg_table_name, v_row), v_summary, v_changes);

  return null;
end;
$$;

create or replace function private.audit_qa_case_courses()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_case_id     uuid := coalesce(new.case_id, old.case_id);
  v_case_no     bigint;
  v_course      text;
  v_actor       uuid := auth.uid();
  v_actor_name  text;
  v_actor_email text;
begin
  if current_setting('app.skip_audit', true) = 'on' then
    return null;
  end if;
  select case_no into v_case_no from public.qa_cases where id = v_case_id;
  -- The whole case was deleted; that is already logged as "Deleted a case".
  if tg_op = 'DELETE' and v_case_no is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.course_id = new.course_id and old.case_id = new.case_id then
    return null;
  end if;

  select name into v_course from public.courses where id = coalesce(new.course_id, old.course_id);

  if v_actor is not null then
    select full_name, email into v_actor_name, v_actor_email from public.profiles where id = v_actor;
  end if;

  insert into public.activity_log
    (actor_id, actor_name, actor_email, section, action, record_type, record_id, record_label, summary, changes)
  values
    (v_actor, v_actor_name, v_actor_email, 'quality_analyst', 'Edited a case', 'qa_cases', v_case_id::text,
     'QA-' || lpad(v_case_no::text, 4, '0'),
     case when tg_op = 'DELETE' then 'Removed course ' else 'Added course ' end || coalesce(v_course, ''),
     jsonb_build_object('courses', jsonb_build_object(
       'before', case when tg_op <> 'INSERT' then (select to_jsonb(name) from public.courses where id = old.course_id) end,
       'after',  case when tg_op <> 'DELETE' then to_jsonb(v_course) end)));

  return null;
end;
$$;

-- Fill labels for entries logged before this migration.
update public.activity_log a set record_label = private.record_label(a.record_type, t.row)
from (
  select 'qa_cases' as tbl, id::text as id, to_jsonb(q) as row from public.qa_cases q
  union all select 'curriculum_customer_cases', id::text, to_jsonb(c) from public.curriculum_customer_cases c
  union all select 'curriculum_instructor_requests', id::text, to_jsonb(r) from public.curriculum_instructor_requests r
  union all select 'mentor_cases', id::text, to_jsonb(m) from public.mentor_cases m
  union all select 'profiles', id::text, to_jsonb(p) from public.profiles p
) t
where a.record_label is null and a.record_type = t.tbl and a.record_id = t.id;

-- Deleted records: use the number captured in the log itself.
update public.activity_log
set record_label = private.record_label(record_type, jsonb_build_object(
  'case_no', coalesce(changes -> 'case_no' ->> 'before', changes -> 'case_no' ->> 'after'),
  'full_name', coalesce(changes -> 'full_name' ->> 'before', changes -> 'full_name' ->> 'after'),
  'email', coalesce(changes -> 'email' ->> 'before', changes -> 'email' ->> 'after')))
where record_label is null;

-- -----------------------------------------------------------------------------
-- Super-admin helpers, callable from the Admin Dashboard
-- -----------------------------------------------------------------------------
create or replace function public.admin_log_event(p_action text, p_record_id text, p_label text, p_summary text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'Only super-admins can do this.' using errcode = '42501';
  end if;
  insert into public.activity_log (actor_id, actor_name, actor_email, action, record_type, record_id, record_label, summary)
  select p.id, p.full_name, p.email, p_action, 'profiles', p_record_id, p_label, p_summary
  from public.profiles p where p.id = auth.uid();
end;
$$;

create or replace function public.admin_claim_event(p_record_id text, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'Only super-admins can do this.' using errcode = '42501';
  end if;
  update public.activity_log a
  set actor_id = p.id, actor_name = p.full_name, actor_email = p.email
  from public.profiles p
  where p.id = auth.uid()
    and a.id = (
      select id from public.activity_log
      where record_id = p_record_id and action = p_action and actor_id is null
        and occurred_at > now() - interval '5 minutes'
      order by id desc limit 1
    );
end;
$$;

revoke all on function public.admin_log_event(text, text, text, text) from public, anon;
revoke all on function public.admin_claim_event(text, text) from public, anon;
grant execute on function public.admin_log_event(text, text, text, text) to authenticated;
grant execute on function public.admin_claim_event(text, text) to authenticated;
