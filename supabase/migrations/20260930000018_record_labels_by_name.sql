-- =============================================================================
-- Experience Hub — 018: name records by customer, not by number
--
-- Owner decision (2026-09-30): tables and panels show the customer's name
-- instead of "QA-0017" / "MEN-0011". The Activity Log follows suit: its
-- "Record" column shows the customer (or requester) name.
-- Case numbers still exist behind the scenes.
-- =============================================================================

create or replace function private.record_label(p_table text, p_row jsonb)
returns text
language sql immutable set search_path = ''
as $$
  select case p_table
    when 'qa_cases' then coalesce(nullif(trim(p_row ->> 'customer_name'), ''), 'No customer name')
    when 'curriculum_customer_cases' then coalesce(nullif(trim(p_row ->> 'customer_name'), ''), 'No customer name')
    when 'mentor_cases' then coalesce(nullif(trim(p_row ->> 'customer_name'), ''), 'No customer name')
    when 'curriculum_instructor_requests' then coalesce(nullif(trim(p_row ->> 'requester_name'), ''), 'No requester')
    when 'profiles' then coalesce(nullif(p_row ->> 'full_name', ''), p_row ->> 'email')
  end;
$$;

-- Course-list changes on Returned cases: label with the case's customer too.
create or replace function private.audit_qa_case_courses()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_case_id     uuid := coalesce(new.case_id, old.case_id);
  v_case        jsonb;
  v_course      text;
  v_actor       uuid := auth.uid();
  v_actor_name  text;
  v_actor_email text;
begin
  if current_setting('app.skip_audit', true) = 'on' then
    return null;
  end if;
  select to_jsonb(q) into v_case from public.qa_cases q where id = v_case_id;
  -- The whole case was deleted; that is already logged as "Deleted a case".
  if tg_op = 'DELETE' and v_case is null then
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
     private.record_label('qa_cases', v_case),
     case when tg_op = 'DELETE' then 'Removed course ' else 'Added course ' end || coalesce(v_course, ''),
     jsonb_build_object('courses', jsonb_build_object(
       'before', case when tg_op <> 'INSERT' then (select to_jsonb(name) from public.courses where id = old.course_id) end,
       'after',  case when tg_op <> 'DELETE' then to_jsonb(v_course) end)));
  return null;
end;
$$;

-- Update existing log entries: current name for records that still exist ...
update public.activity_log a set record_label = private.record_label(a.record_type, t.row)
from (
  select 'qa_cases' as tbl, id::text as id, to_jsonb(q) as row from public.qa_cases q
  union all select 'curriculum_customer_cases', id::text, to_jsonb(c) from public.curriculum_customer_cases c
  union all select 'curriculum_instructor_requests', id::text, to_jsonb(r) from public.curriculum_instructor_requests r
  union all select 'mentor_cases', id::text, to_jsonb(m) from public.mentor_cases m
) t
where a.record_type = t.tbl and a.record_id = t.id;

-- ... and the name captured in the log itself for records that were deleted.
update public.activity_log
set record_label = private.record_label(record_type, jsonb_build_object(
  'customer_name', coalesce(changes -> 'customer_name' ->> 'before', changes -> 'customer_name' ->> 'after'),
  'requester_name', coalesce(changes -> 'requester_name' ->> 'before', changes -> 'requester_name' ->> 'after')))
where record_type in ('qa_cases', 'curriculum_customer_cases', 'curriculum_instructor_requests', 'mentor_cases')
  and record_label ~ '^(QA|CUR|REQ|MEN)-\d+$';
