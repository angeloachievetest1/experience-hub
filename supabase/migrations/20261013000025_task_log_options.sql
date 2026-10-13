-- Operation Tasks / Task Log (Quality Analyst): dropdown lists, managed on the
-- Case options page like every other list. A–Z, as the owner listed them
-- (2026-10-13). "Others" isn't a value: the Task Log adds it at the end of
-- Type and Error 1 and lets you type the value in.
--
-- The two lists of staff names (qa_task_person: Manager and Handled by;
-- qa_task_auditor) are added straight to the database, not here, so names
-- stay out of the code (same as instructors and mentors).

set local app.skip_audit = 'on'; -- starting values, not changes: keep them out of the Activity Log

insert into public.option_values (list_key, value, sort_order)
select l.list_key, v.value, v.ord
from (values
  ('qa_task_record_type', array['eLearning', 'Instructor']),
  ('qa_task_type', array[
    'Course Cancellation/Reschedule', 'IT Concerns', 'Payroll', 'Scheduling',
    'Study Guide Requests', 'Substitute Request', 'Tutoring', 'Virtual Recordings']),
  ('qa_task_error', array[
    'Delayed Acknowledgment', 'Failure to Address Customer Complaints', 'Improper Case Closure',
    'Improper Reassignment', 'Inaccuracies on Email, SMS', 'Incomplete Case Details',
    'Incomplete or Unclear Resolution', 'Incorrect Case Priority & Status Updates',
    'Lack of Follow-up or Escalation Notes', 'Missed Resolution Timeframe',
    'Missing Customer Communication', 'Missing Documentation', 'Non-Compliance with Policies',
    'Unclear or Incomplete Case Notes', 'Unprofessional or Disrespectful Interaction']),
  ('qa_task_error_category', array[
    'Case Accuracy & Completeness', 'Case Handling & Updates', 'Case Resolution & Closure',
    'Compliance & Policy Adherence'])
) as l(list_key, vals)
cross join lateral unnest(l.vals) with ordinality as v(value, ord)
on conflict (list_key, value) do nothing;
