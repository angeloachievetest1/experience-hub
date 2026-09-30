-- =============================================================================
-- Experience Hub — 023: Case options (Admin Dashboard)
--
-- Super-admins manage courses, instructors, mentors and every other dropdown
-- (option_values) from the Case options page.
--
--   * Every change to these four tables is written to the Activity Log by a
--     trigger, so changes made anywhere (the page, the Supabase dashboard) are
--     never missed. Changes made through the page carry the list's name.
--   * Renaming an option that cases store as text also updates those cases, in
--     one step and as ONE log entry ("... · 72 cases updated").
--   * Reordering a list is one log entry, not one per row.
--   * Options still used by cases can't be deleted (hide them instead).
--   * Lists the dashboards count by exact value are locked for app users.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Which case fields store each list's values (as text).
-- Keep in sync with LIST_DEFS in lib/admin/lists.ts.
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

-- Lists whose exact values the dashboards count.
create or replace function private.is_locked_option_list(p_list_key text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_list_key in ('qa_source', 'qa_validity', 'mentor_status', 'mentor_validity');
$$;

-- The section a case option belongs to (courses are shared by all: null).
create or replace function private.case_option_section(p_table text, p_list_key text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_table = 'instructors' then 'quality_analyst'
    when p_table = 'mentors' then 'mentor'
    when p_table = 'option_values' then case
      when p_list_key like 'qa\_%' then 'quality_analyst'
      when p_list_key like 'cur\_%' then 'curriculum'
      when p_list_key like 'mentor\_%' then 'mentor'
    end
  end;
$$;

-- Cases that use one option value (a case counts once, even if several fields hold it).
create or replace function private.case_option_case_ids(p_list_key text, p_value text)
returns uuid[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  f        record;
  v_array  boolean;
  v_found  uuid[];
  v_ids    uuid[] := '{}';
begin
  for f in select * from private.case_option_fields(p_list_key) loop
    select c.data_type = 'ARRAY' into v_array
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = f.tbl and c.column_name = f.col;
    execute format('select coalesce(array_agg(id), ''{}'') from public.%I where %s%s',
      f.tbl,
      case when v_array then format('$1 = any(%I)', f.col) else format('%I = $1', f.col) end,
      case when f.src is not null then format(' and source = %L', f.src) else '' end)
    into v_found using p_value;
    v_ids := v_ids || v_found;
  end loop;
  return array(select distinct x from unnest(v_ids) as x);
end;
$$;

-- -----------------------------------------------------------------------------
-- Locked lists: app users can't add, rename, hide, reorder or delete in them.
-- (Migrations and scripts, which have no signed-in user, still can.)
-- -----------------------------------------------------------------------------
create or replace function private.guard_locked_options()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and (
       (tg_op <> 'INSERT' and private.is_locked_option_list(old.list_key))
    or (tg_op <> 'DELETE' and private.is_locked_option_list(new.list_key))) then
    raise exception 'This list is locked: the dashboards count its exact values.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_locked_options
  before insert or update or delete on public.option_values
  for each row execute function private.guard_locked_options();

-- -----------------------------------------------------------------------------
-- Activity Log for courses, instructors, mentors and option_values.
-- The page sets app.case_option_list (e.g. "Curriculum › Types") and, on a
-- rename, app.cases_updated, so the entry reads well.
-- -----------------------------------------------------------------------------
create or replace function private.audit_case_option()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old         jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new         jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row         jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_col         text := case tg_table_name when 'courses' then 'name' when 'option_values' then 'value' else 'full_name' end;
  v_list        text;
  v_cases       integer := nullif(current_setting('app.cases_updated', true), '')::integer;
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
  where not (k = any (array['id', 'created_at', 'is_sample']))
    and (v_old -> k) is distinct from (v_new -> k)
    and (tg_op = 'UPDATE' or coalesce(v_row -> k, 'null'::jsonb) not in ('null'::jsonb, '[]'::jsonb, '""'::jsonb));

  if tg_op = 'UPDATE' and cardinality(v_fields) = 0 then
    return null;
  end if;

  v_list := coalesce(nullif(current_setting('app.case_option_list', true), ''),
    case tg_table_name when 'courses' then 'Courses' when 'instructors' then 'Instructors'
      when 'mentors' then 'Mentors' else v_row ->> 'list_key' end);

  if tg_op = 'INSERT' then
    v_action := 'Added an option';
    v_summary := format('%s: added “%s”', v_list, v_new ->> v_col);
  elsif tg_op = 'DELETE' then
    v_action := 'Deleted an option';
    v_summary := format('%s: deleted “%s”', v_list, v_old ->> v_col);
  elsif v_col = any (v_fields) then
    v_action := 'Renamed an option';
    v_summary := format('%s: “%s” → “%s”', v_list, v_old ->> v_col, v_new ->> v_col)
      || case when v_cases > 0 then format(' · %s %s updated', v_cases, case when v_cases = 1 then 'case' else 'cases' end) else '' end;
  elsif 'is_active' = any (v_fields) then
    v_action := case when (v_new ->> 'is_active')::boolean then 'Showed an option' else 'Hid an option' end;
    v_summary := format('%s: %s “%s”', v_list, case when (v_new ->> 'is_active')::boolean then 'showed' else 'hid' end, v_new ->> v_col);
  elsif v_fields = array['sort_order'] then
    v_action := 'Changed the order';
    v_summary := format('%s: moved “%s”', v_list, v_new ->> v_col);
  else
    v_action := 'Edited an option';
    select format('%s: changed %s', v_list, string_agg(replace(f, '_', ' '), ', ')) into v_summary from unnest(v_fields) as f;
  end if;

  if v_actor is not null then
    select full_name, email into v_actor_name, v_actor_email from public.profiles where id = v_actor;
  end if;

  insert into public.activity_log
    (actor_id, actor_name, actor_email, section, action, record_type, record_id, record_label, summary, changes)
  values
    (v_actor, v_actor_name, v_actor_email, private.case_option_section(tg_table_name, v_row ->> 'list_key'),
     v_action, tg_table_name, v_row ->> 'id', v_row ->> v_col, v_summary, v_changes);
  return null;
end;
$$;

create trigger audit_case_option after insert or update or delete on public.courses
  for each row execute function private.audit_case_option();
create trigger audit_case_option after insert or update or delete on public.instructors
  for each row execute function private.audit_case_option();
create trigger audit_case_option after insert or update or delete on public.mentors
  for each row execute function private.audit_case_option();
create trigger audit_case_option after insert or update or delete on public.option_values
  for each row execute function private.audit_case_option();

-- -----------------------------------------------------------------------------
-- Actions for the Case options page. Each checks the caller is a super-admin.
-- p_table: courses | instructors | mentors | option_values
-- p_list_label: how the list is named in the log, e.g. "Curriculum › Types"
-- -----------------------------------------------------------------------------
create or replace function private.check_case_option_target(p_table text, p_list_key text)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'Only super-admins can change case options.' using errcode = '42501';
  end if;
  if p_table not in ('courses', 'instructors', 'mentors', 'option_values') then
    raise exception 'Unknown list.';
  end if;
  if p_table = 'option_values' then
    if not exists (select 1 from private.case_option_fields(p_list_key)) then
      raise exception 'Unknown list.';
    end if;
    if private.is_locked_option_list(p_list_key) then
      raise exception 'This list is locked: the dashboards count its exact values.' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

-- Add, hide, show or delete one option. Returns the option's id.
create or replace function public.change_case_option(
  p_action text, p_table text, p_list_key text, p_id uuid, p_name text, p_list_label text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_value text;
  v_id    uuid;
  v_count integer;
begin
  perform private.check_case_option_target(p_table, p_list_key);
  perform set_config('app.case_option_list', coalesce(p_list_label, ''), true);

  if p_action = 'add' then
    if v_name = '' then raise exception 'Enter a name.'; end if;
    if p_table = 'courses' then
      insert into public.courses (name, sort_order)
      values (v_name, (select coalesce(max(sort_order), 0) + 1 from public.courses)) returning id into v_id;
    elsif p_table = 'option_values' then
      insert into public.option_values (list_key, value, sort_order)
      values (p_list_key, v_name, (select coalesce(max(sort_order), 0) + 1 from public.option_values where list_key = p_list_key))
      returning id into v_id;
    else
      execute format('insert into public.%I (full_name) values ($1) returning id', p_table) into v_id using v_name;
    end if;
    return v_id;
  end if;

  if p_table = 'option_values' then
    select value into v_value from public.option_values where id = p_id and list_key = p_list_key;
    if not found then raise exception 'This option no longer exists. Refresh the page.'; end if;
  end if;

  if p_action in ('hide', 'show') then
    execute format('update public.%I set is_active = $1 where id = $2', p_table) using p_action = 'show', p_id;
    get diagnostics v_count = row_count;
  elsif p_action = 'delete' then
    -- Courses, instructors and mentors in use are also protected by foreign keys.
    if p_table = 'option_values' and cardinality(private.case_option_case_ids(p_list_key, v_value)) > 0 then
      raise exception 'Cases still use this option. Hide it instead.' using errcode = '23503';
    end if;
    execute format('delete from public.%I where id = $1', p_table) using p_id;
    get diagnostics v_count = row_count;
  else
    raise exception 'Unknown action.';
  end if;
  if v_count = 0 then raise exception 'This option no longer exists. Refresh the page.'; end if;
  return p_id;
end;
$$;

-- Rename one option. Text options also update every case that stores the old
-- value, logged as one entry. Returns how many cases were updated.
create or replace function public.rename_case_option(
  p_table text, p_list_key text, p_id uuid, p_name text, p_list_label text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_skip  text := coalesce(current_setting('app.skip_audit', true), '');
  v_old   text;
  v_ids   uuid[] := '{}';
  v_found uuid[];
  v_array boolean;
  v_count integer;
  f       record;
begin
  perform private.check_case_option_target(p_table, p_list_key);
  if v_name = '' then raise exception 'Enter a name.'; end if;
  perform set_config('app.case_option_list', coalesce(p_list_label, ''), true);

  if p_table <> 'option_values' then
    execute format('update public.%I set %I = $1 where id = $2', p_table,
      case p_table when 'courses' then 'name' else 'full_name' end) using v_name, p_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then raise exception 'This option no longer exists. Refresh the page.'; end if;
    return 0;
  end if;

  select value into v_old from public.option_values where id = p_id and list_key = p_list_key for update;
  if not found then raise exception 'This option no longer exists. Refresh the page.'; end if;
  if v_old = v_name then return 0; end if;

  -- The cases first, without an "Edited a case" entry for each one.
  perform set_config('app.skip_audit', 'on', true);
  for f in select * from private.case_option_fields(p_list_key) loop
    select c.data_type = 'ARRAY' into v_array
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = f.tbl and c.column_name = f.col;
    execute format('with u as (update public.%I set %I = %s where %s%s returning id) select coalesce(array_agg(id), ''{}'') from u',
      f.tbl, f.col,
      case when v_array then format('array_replace(%I, $1, $2)', f.col) else '$2' end,
      case when v_array then format('$1 = any(%I)', f.col) else format('%I = $1', f.col) end,
      case when f.src is not null then format(' and source = %L', f.src) else '' end)
    into v_found using v_old, v_name;
    v_ids := v_ids || v_found;
  end loop;
  perform set_config('app.skip_audit', v_skip, true);

  -- Then the option itself: the trigger writes the one log entry.
  perform set_config('app.cases_updated', (select count(distinct x) from unnest(v_ids) as x)::text, true);
  update public.option_values set value = v_name where id = p_id;
  perform set_config('app.cases_updated', '', true);
  return (select count(distinct x) from unnest(v_ids) as x);
end;
$$;

-- Save a new order for Courses or an option list, logged as one entry.
-- p_ids: every option in the list, in the new order. p_moved: the one dragged.
create or replace function public.reorder_case_options(
  p_table text, p_list_key text, p_ids uuid[], p_moved uuid, p_list_label text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_skip  text := coalesce(current_setting('app.skip_audit', true), '');
  v_rows  uuid[];
  v_from  integer;
  v_to    integer := array_position(p_ids, p_moved);
  v_name  text;
begin
  perform private.check_case_option_target(p_table, p_list_key);
  if p_table not in ('courses', 'option_values') then
    raise exception 'This list is always in alphabetical order.';
  end if;

  if p_table = 'courses' then
    select array_agg(id order by sort_order, name) into v_rows from public.courses;
    select name into v_name from public.courses where id = p_moved;
  else
    select array_agg(id order by sort_order, value) into v_rows from public.option_values where list_key = p_list_key;
    select value into v_name from public.option_values where id = p_moved and list_key = p_list_key;
  end if;
  if v_to is null or cardinality(p_ids) <> cardinality(v_rows)
     or exists (select 1 from unnest(v_rows) as r where not r = any (p_ids)) then
    raise exception 'The list changed while you were editing. Refresh the page and try again.';
  end if;
  v_from := array_position(v_rows, p_moved);
  if v_from = v_to then return; end if;

  perform set_config('app.skip_audit', 'on', true);
  if p_table = 'courses' then
    update public.courses c set sort_order = array_position(p_ids, c.id) where c.id = any (p_ids);
  else
    update public.option_values o set sort_order = array_position(p_ids, o.id) where o.list_key = p_list_key;
  end if;
  perform set_config('app.skip_audit', v_skip, true);

  insert into public.activity_log
    (actor_id, actor_name, actor_email, section, action, record_type, record_id, record_label, summary, changes)
  select p.id, p.full_name, p.email, private.case_option_section(p_table, p_list_key), 'Changed the order',
    p_table, p_moved::text, v_name,
    format('%s: “%s” moved from position %s to %s', coalesce(nullif(p_list_label, ''), p_table), v_name, v_from, v_to),
    jsonb_build_object('position', jsonb_build_object('before', v_from, 'after', v_to))
  from public.profiles p where p.id = auth.uid();
end;
$$;

revoke all on function private.case_option_fields(text) from public;
revoke all on function private.is_locked_option_list(text) from public;
revoke all on function private.case_option_section(text, text) from public;
revoke all on function private.case_option_case_ids(text, text) from public;
revoke all on function private.check_case_option_target(text, text) from public;
revoke all on function public.change_case_option(text, text, text, uuid, text, text) from public, anon;
revoke all on function public.rename_case_option(text, text, uuid, text, text) from public, anon;
revoke all on function public.reorder_case_options(text, text, uuid[], uuid, text) from public, anon;
grant execute on function public.change_case_option(text, text, text, uuid, text, text) to authenticated;
grant execute on function public.rename_case_option(text, text, uuid, text, text) to authenticated;
grant execute on function public.reorder_case_options(text, text, uuid[], uuid, text) to authenticated;
