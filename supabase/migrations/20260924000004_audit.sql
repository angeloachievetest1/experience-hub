-- =============================================================================
-- Experience Hub — 004: audit trail
--
--   activity_log   one row for every create / edit / delete of a case, and every
--                  change to a user profile (role, sections, super-admin flag,
--                  status, ...). Written by database triggers, so nothing done
--                  through the app, the import script or the SQL editor is missed.
--   login_history  one row for every successful sign-in, written by a trigger on
--                  Supabase Auth's sessions table (a new session is created only
--                  when a sign-in succeeds; token refreshes do not add rows).
--
-- Both tables are read-only through the app and visible to super-admins only.
-- =============================================================================

create table public.activity_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,          -- no foreign key: history survives user deletion
  actor_name   text,          -- snapshot at the time of the action
  actor_email  text,
  section      text check (section in ('quality_analyst', 'curriculum', 'mentor')),  -- null for user admin
  action       text not null, -- e.g. Added a case, Edited a case, Changed a role
  record_type  text not null, -- table name, e.g. qa_cases, profiles
  record_id    text,
  summary      text,
  changes      jsonb not null default '{}'  -- { field: { before, after } }
);

create index activity_log_occurred_at_idx on public.activity_log (occurred_at desc);
create index activity_log_section_idx on public.activity_log (section, occurred_at desc);
create index activity_log_actor_idx on public.activity_log (actor_id);
create index activity_log_action_idx on public.activity_log (action);

create table public.login_history (
  id            bigint generated always as identity primary key,
  signed_in_at  timestamptz not null default now(),
  user_id       uuid not null, -- no foreign key: history survives user deletion
  user_email    text,
  user_name     text,
  session_id    uuid unique,
  ip            text,
  user_agent    text
);

create index login_history_signed_in_at_idx on public.login_history (signed_in_at desc);
create index login_history_user_idx on public.login_history (user_id, signed_in_at desc);

-- -----------------------------------------------------------------------------
-- Generic audit trigger. Argument: 'quality_analyst' | 'curriculum' | 'mentor'
-- for case tables, or 'users' for profiles.
-- -----------------------------------------------------------------------------
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
  select coalesce(jsonb_object_agg(k, jsonb_build_object('before', v_old -> k, 'after', v_new -> k)), '{}'::jsonb),
         coalesce(array_agg(k order by k), '{}')
    into v_changes, v_fields
  from jsonb_object_keys(v_row) as k
  where not (k = any (v_ignored))
    and (v_old -> k) is distinct from (v_new -> k)
    -- on create/delete, skip empty fields to keep the log readable
    and (tg_op = 'UPDATE' or coalesce(v_row -> k, 'null'::jsonb) not in ('null'::jsonb, '[]'::jsonb, '""'::jsonb));

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
    v_summary := v_action || ': ' || coalesce(nullif(v_row ->> 'full_name', ''), v_row ->> 'email');
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
    (actor_id, actor_name, actor_email, section, action, record_type, record_id, summary, changes)
  values
    (v_actor, v_actor_name, v_actor_email, nullif(v_scope, 'users'), v_action,
     tg_table_name, v_row ->> 'id', v_summary, v_changes);

  return null;
end;
$$;

-- Course list on Returned QA cases: logged as an edit of the parent case.
create or replace function private.audit_qa_case_courses()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_case_id     uuid := coalesce(new.case_id, old.case_id);
  v_course      text;
  v_actor       uuid := auth.uid();
  v_actor_name  text;
  v_actor_email text;
begin
  -- The whole case was deleted; that is already logged as "Deleted a case".
  if tg_op = 'DELETE' and not exists (select 1 from public.qa_cases where id = old.case_id) then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.course_id = new.course_id and old.case_id = new.case_id then
    return null;
  end if;

  select name into v_course from public.courses where id = coalesce(new.course_id, old.course_id);

  if v_actor is not null then
    select full_name, email into v_actor_name, v_actor_email
    from public.profiles where id = v_actor;
  end if;

  insert into public.activity_log
    (actor_id, actor_name, actor_email, section, action, record_type, record_id, summary, changes)
  values
    (v_actor, v_actor_name, v_actor_email, 'quality_analyst', 'Edited a case', 'qa_cases', v_case_id::text,
     case when tg_op = 'DELETE' then 'Removed course ' else 'Added course ' end || coalesce(v_course, ''),
     jsonb_build_object('courses', jsonb_build_object(
       'before', case when tg_op <> 'INSERT' then (select to_jsonb(name) from public.courses where id = old.course_id) end,
       'after',  case when tg_op <> 'DELETE' then to_jsonb(v_course) end)));

  return null;
end;
$$;

create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function private.audit_row_change('users');

create trigger audit_qa_cases
  after insert or update or delete on public.qa_cases
  for each row execute function private.audit_row_change('quality_analyst');

create trigger audit_qa_case_courses
  after insert or update or delete on public.qa_case_courses
  for each row execute function private.audit_qa_case_courses();

create trigger audit_curriculum_customer_cases
  after insert or update or delete on public.curriculum_customer_cases
  for each row execute function private.audit_row_change('curriculum');

create trigger audit_curriculum_instructor_requests
  after insert or update or delete on public.curriculum_instructor_requests
  for each row execute function private.audit_row_change('curriculum');

create trigger audit_mentor_cases
  after insert or update or delete on public.mentor_cases
  for each row execute function private.audit_row_change('mentor');

-- -----------------------------------------------------------------------------
-- Login history: a new row in auth.sessions means a successful sign-in.
-- -----------------------------------------------------------------------------
create or replace function private.record_login()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_session jsonb := to_jsonb(new);
begin
  insert into public.login_history (signed_in_at, user_id, user_email, user_name, session_id, ip, user_agent)
  select coalesce(new.created_at, now()), new.user_id, u.email, p.full_name, new.id,
         v_session ->> 'ip', v_session ->> 'user_agent'
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = new.user_id
  on conflict (session_id) do nothing;
  return null;
end;
$$;

create trigger on_auth_session_created
  after insert on auth.sessions
  for each row execute function private.record_login();

-- -----------------------------------------------------------------------------
-- Row-level security: super-admins read; nobody writes through the app.
-- -----------------------------------------------------------------------------
alter table public.activity_log enable row level security;
alter table public.login_history enable row level security;

create policy "Super-admins read activity log" on public.activity_log
  for select to authenticated using ((select private.is_super_admin()));

create policy "Super-admins read login history" on public.login_history
  for select to authenticated using ((select private.is_super_admin()));

revoke all on public.activity_log, public.login_history from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.activity_log, public.login_history from authenticated;
grant select on public.activity_log, public.login_history to authenticated;
