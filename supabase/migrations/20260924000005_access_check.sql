-- =============================================================================
-- Experience Hub — 005: "Test my write access"
--
-- Called from the Home page. For each section it tries to add a case AS THE
-- SIGNED-IN USER (security invoker, so row-level security applies), then
-- always undoes the attempt. Nothing is saved and nothing is written to the
-- activity log. Returns e.g. {"quality_analyst": false, "curriculum": false, "mentor": true}.
-- =============================================================================

create or replace function public.check_write_access()
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_result jsonb := '{}';
  v_section text;
begin
  foreach v_section in array array['quality_analyst', 'curriculum', 'mentor'] loop
    begin
      case v_section
        when 'quality_analyst' then
          insert into public.qa_cases (source, customer_name, is_sample)
          values ('Survey', 'Write access check (never saved)', true);
        when 'curriculum' then
          insert into public.curriculum_customer_cases (customer_name, is_sample)
          values ('Write access check (never saved)', true);
        when 'mentor' then
          insert into public.mentor_cases (customer_name, is_sample)
          values ('Write access check (never saved)', true);
      end case;
      -- The insert worked. Raise to roll it back (and its audit row).
      raise exception using errcode = 'EH001', message = 'access check rollback';
    exception
      when insufficient_privilege then
        v_result := v_result || jsonb_build_object(v_section, false);
      when sqlstate 'EH001' then
        v_result := v_result || jsonb_build_object(v_section, true);
    end;
  end loop;
  return v_result;
end;
$$;

revoke all on function public.check_write_access() from public, anon;
grant execute on function public.check_write_access() to authenticated;
