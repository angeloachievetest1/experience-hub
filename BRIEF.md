# Experience Hub — Build Brief for Claude Code

## How to use this brief (read first)

- The owner of this project is **not a developer**. Explain anything they must do themselves (installing, clicking in Supabase, etc.) in plain, step-by-step language.
- Work **one phase at a time**. Do only the phase you are asked for. At the end of each phase: stop, list what the owner should click through to test it locally, and commit + push to GitHub.
- **Do not deploy to Netlify, connect the repo to Netlify, or add Netlify config until Phase 5.** All testing in Phases 1–4 happens locally (`npm run dev`, http://localhost:3000) against the cloud Supabase project. The owner wants exactly one Netlify deployment, at the end.
- Items marked **[DEFAULT]** are decisions made so the build is not blocked. Build them as written, but keep them easy to change later.
- Items marked **[NEEDS INPUT]** are missing information. Build around them with clear placeholders; do not invent data.
- Visual references: the two prototypes' source files are in `/docs/reference/experience-hub-prototype/` and `/docs/reference/experience-hub-dashboard-prototype/`. In each, `project/Main.dc.html` holds the pages, layout, labels and sample data. They use a proprietary format that won't run here, so treat them as a read-only design reference: match their look and behaviour, but build fresh Next.js code rather than copying or porting their runtime files.

---

## 1. What this application is

A single internal, staff-only web app replacing spreadsheet tracking for three teams — **Quality Analyst**, **Curriculum**, **Mentor** — each with its own dashboard and case log, plus an **Admin Dashboard** for managing users and viewing an audit trail.

Product name: **Experience Hub**. Admin area name: **Experience Hub Dashboard**.

**Stack**
- Next.js (React) + Tailwind CSS
- Supabase: Postgres, Auth, row-level security (RLS)
- GitHub for version control
- Netlify for hosting (Phase 5 only)

---

## 2. Branding

| Token | Value |
|---|---|
| Primary (actions/buttons) | `#FF4500` |
| Secondary (accent) | `#9F7DFF` |
| Text | `#2D1559` — no pure black anywhere |
| Highlight (sparingly) | `#DDFF7D` |
| Backgrounds | `#FFE3D9`, `#FFEFE9`, `#FFF5F2`, `#DDD1FF`, `#EAE2FF`, `#F6F3FF` |
| Headline font | Bitter (Light / Regular / SemiBold) |
| Body font | DM Sans |

---

## 3. Users, roles and permissions

**Roles**
- **Viewer** — read access to all three sections. Cannot create, edit or delete anything.
- **Admin** — read access to all three sections. Write access (create/edit/delete cases) **only** in their assigned section(s): any combination of Quality Analyst, Curriculum, Mentor. Outside their sections they see no edit/delete controls.
- **Super-admin flag [DEFAULT]** — a separate checkbox on the user profile. Only users with this flag can open the Admin Dashboard (users, activity log, login history) and change anyone's role, sections or status. Role and sections do not affect this flag.

Role, sections and super-admin flag are set on the user's own profile. There is no separate roles/permissions screen.

**User profile fields:** full name, email, password (handled by Supabase Auth), department (free text), role, assigned sections, super-admin flag, status (Active / Deactivated), deactivation note (optional free text, shown on hover, not inline).

**Security requirements (core, in scope)**
- Permissions must be enforced **in the database with Supabase RLS**, not only by hiding buttons. The UI should simply reflect what RLS allows.
- Deactivated users must be **unable to sign in** (ban them in Supabase Auth) and RLS must deny them any access.
- Creating users, setting/changing passwords, and deactivating users require the Supabase **service role key**. Do this only in Next.js server-side code (route handlers / server actions). The service role key must never reach the browser. Store keys in `.env.local` (git-ignored) now; they move to Netlify environment variables in Phase 5.
- Password reset emails and invite emails are out of scope. Instead, a super-admin can set a new password for any user from the Admin Dashboard.
- **First admin [DEFAULT]:** give the owner plain steps to create their own account in the Supabase dashboard, plus a one-line SQL snippet that makes it an Admin with all three sections and the super-admin flag.

**Audit trail (core, in scope)**
- Every create/edit/delete of a case, and every change to a user's role, sections, super-admin flag or status, writes an Activity Log row. Use **Postgres triggers** so nothing is missed. Store: when, who, section, action type, record type, record id, and a before/after summary of changed fields.
- Every successful sign-in writes a Login History row (when, user). Choose a reliable server-side mechanism (e.g. trigger on Supabase auth session creation) rather than trusting the browser.
- Audit tables are read-only to everyone through the app; only super-admins can read them.

---

## 4. Shared lookup tables

- **Courses** — one shared table used by Quality Analyst, Curriculum and Mentor (not three copies):
  American Government, Art of the Western World, Biology, Career Guidance, Chemistry, College Algebra, College Composition, College Composition (with modular), College Mathematics, Dental Hygiene Entrance Exam Prep, ESL Health, Ethics in America, Fundamentals of Math, History of the United States 1, Human Growth and Development, Humanities, Introduction to Psychology, Macroeconomics, Microeconomics, National Board of Dental Hygienist Examination, Next Gen NCLEX PN Prep, Next Gen NCLEX RN Prep, Nursing Entrance Exam Prep, SAT/ACT Prep, Sociology, Spanish 1, Spanish 2, Speech, Statistics, World Religions, ATI TEAS.
- **Instructors** — master list used by Quality Analyst. **[NEEDS INPUT]** will be supplied as `/data/instructors.csv`. Build the table and a placeholder file.
- **Mentors:** Diana Saad, Ifrah Naaz, Ivana Panajotov, Kelly Lawson, Mira Zarrouf, Tamaryn Du Preez, Tonya Clarke, Winfred Miano.
- Other fixed option lists (categories, types, statuses) may be enums or lookup tables — your choice, but keep them easy to extend.

The three sections use different customer/case identifiers. Keep them in **separate tables with no relationships between sections**.

---

## 5. Section: Quality Analyst

**Data model:** one case table with a `source` field: `Instructor`, `Course`, `Survey`, or `Returned` **[DEFAULT: Returned is a fourth source value in the same table]**. Fields that don't apply to a source stay null.

**Common fields:** date, customer name, course, instructor, case link (plain URL — Kustomer or Salesforce), analyst, category, validity, follow-up status (email / SMS / call sent; reached or not).

**Validity values [DEFAULT]:** `Valid`, `Partially Valid`, `Not Valid`, `N/A`. On import, map `Invalid` → `Not Valid`; keep `N/A` as its own value.

**Instructor source:** attendance %, participation %, Moodle %, course end date.
Categories: Instructor Performance, Customer Experience.
Types (multi-select): Accent, Pace, Teaching Style, Professionalism, Lesson organization, Connectivity Issues — extendable.

**Course source:** case closed by.
Categories: Customer Experience, Course & Preferences.
Types: Course Cancellation, Course Extension, Tutoring Concerns, Connectivity Issues, Class Notifications, Book, Course Resources.

**Survey source:** survey type, survey ID, rating (1–6), customer comment, reason type.
Survey types (use these names; original sheet labels in brackets): AFCS [FCS], ECS [ECF], MCS [MCF], PES [PEF], PTS [Post Tutoring].
Reason types: Not Reached, Study Concern, Instructor Related, Good Comment/Low Score - Mistake, Exam Content - Course Content Mismatch, Tech Issues, Customer Personal Issues, Internal Process, Moodle Concern, Exam Experience, Pacing/Timing Related.

**Returned source:** reassign reason. **Course is multi-select for this source only** (the only multi-course field in the app). **[NEEDS INPUT]** any further Returned fields — build with reassign reason + common fields for now.

**Pages**
1. **Dashboard** — total records, monthly/quarterly trend, validity split, source filter; category and complaint-type breakdowns for Instructor/Course cases, plus their validity split.
2. **Survey insights** — surveys per month by type, reason type by month, reason type by survey type, rating distribution, total by type; date-range filter.
3. **Case log** — one searchable table across all sources; multi-select Source filter; Analyst, Category, Validity filters; search; date range; **Add case** (pick source → create blank record → open for editing); **Delete case** with confirm.
4. **Instructor view** / **Course view** — complaints and low scores grouped by instructor or course; "most common issues"; validity split for the selected instructor/course.
5. **Follow-up view** — unreached customers, urgent-action cases, records with no case link, reach rate by channel.

**Import cleanup rules**
- Unify instructor name spellings against the master list (e.g. "Daniel Wolf" / "Daniel Wolff").
- Validity mapping as above.
- Course Complaints has no rows July 2025 – January 2026. Charts must show this as **missing data (a gap), not zero**.

---

## 6. Section: Curriculum

Two separate record types, in separate tables.

**A. Customer Cases** (customer complaints about course content)
Fields: date, customer, course (shared dropdown), category, material type (e.g. "Achieve Material"), Curriculum SME, TM on SF, comments/complaints, feedback/progress made, resolution TAT (days), date resolved.
`Case Resolution` and `Case Status in SF` exist in the sheet but are always blank — store them if present, build **no** functionality around them.
Categories: Social Science, Humanities, Nursing Exam, Dental Exam, Language, Mathematics.

**B. Instructors Cases** ("Instructor requests") — instructors' and mentors' own feedback about content errors, **not** customer complaints, and **not** related to the Mentor section.
Fields: requester name, date submitted, course (shared dropdown), feedback type (Instructor Feedback / Mentoring Feedback / Cx Feedback), base material, comments, status (Complete / In Progress / Not Started / Not Required), notes, date completed, ticket manager.
Sheet rows with blank requester and course are continuations of the row above: import them as child lines of the parent request, not separate cases.

**Pages:** Dashboard (total cases, trend by month, category/material breakdown, avg resolution time, 5-year trend — all computed live from case rows **[DEFAULT]**), Case log (Customer Cases, with Add/Delete case), Instructor requests (Instructors Cases, continuation lines grouped under parent).

**Import cleanup:** resolve course-name variants to the dropdown list by frequency (e.g. "Nursing Entrance Exam Preparation" → "Nursing Entrance Exam Prep"). Dates are MM/DD/YYYY. During import, report any cases that look miscategorized (e.g. dental courses under Nursing Exam) for the owner to review — do not auto-change them.

---

## 7. Section: Mentor

Customer complaints **about mentors**.

Fields: Date **[DEFAULT: included]**, Year, Quarter (Q1–Q4, stored separately), Customer name, Mentor name, Course (shared dropdown), Complaint Type (Course / Mentor / Feedback), Complaint Sub Type (Accent, Cancellation, Communication, Connectivity Issues, Course, Course Extension, Lesson organization, Other/Add comment, Pace, Professionalism, Session Duration, Teaching Style, Unresponsive), Complaint Analysis (Valid / Partially Valid / Not Valid), Status (New / In-progress / Closed), Case Closed by (Curriculum / Customer Success / eLearning Operation / Mentor Coordinator), Email Sent (Yes/No), Email/SMS Preview (free text), Case link (plain URL).

**Pages:** Dashboard (total complaints; closed / in-progress / valid counts; by year, quarter, complaint type, mentor; validity split), Case log (filters: Mentor, Complaint type, Sub type, Status, Validity; Add/Delete case).

---

## 8. Admin Dashboard (super-admins only)

1. **Users** — table: name, email, department, role, sections, super-admin, status. Filters: multi-select Section and Status, single-select Role, search. **Add user**, **Delete user** (confirm), edit profile, set new password, deactivate with optional note. Export CSV of the current filtered view.
2. **Activity Log** — **tabs** (All / Quality Analyst / Curriculum / Mentor), not a dropdown. Also User filter, multi-select Action type, date range, search, Export CSV.
3. **Login History** — separate from Activity Log. When + User; user filter, date range, Export CSV.

---

## 9. Build phases

**Phase 1 — Foundation (local only)**
- Next.js + Tailwind project with branding tokens and fonts.
- Full Supabase schema for **all** sections, lookups, profiles and audit tables (so later phases don't need restructuring), as SQL migration files in the repo.
- Auth: sign-in page, sign-out, session handling; deactivated users blocked.
- RLS policies for every table, audit triggers, login-history recording.
- App shell: navigation between Quality Analyst / Curriculum / Mentor / Admin Dashboard (Admin link only for super-admins), empty placeholder pages.
- Seed the lookup tables (courses, mentors, option lists).
- Steps for the owner to create the first super-admin account.
- Test checklist: sign in, see navigation, confirm a Viewer test account cannot write (show how to check).

**Phase 2 — Quality Analyst section**
All five pages from section 5, with Add/Edit/Delete respecting permissions. Use a few sample records for testing (clearly marked, easy to delete).

**Phase 3 — Curriculum and Mentor sections**
All pages from sections 6 and 7.

**Phase 4 — Admin Dashboard and data import**
- All three Admin pages from section 8, including server-side user creation and password setting.
- A one-time import script run locally: reads CSV exports from `/data/import/`, applies every cleanup rule, and first runs in **dry-run mode**, printing a report (row counts, name/course/validity changes made, rows it couldn't match, suspected miscategorizations) before writing anything. **[NEEDS INPUT]** full sheet exports and the instructor master list.
- Remove the sample records.

**Phase 5 — Single Netlify deployment**
- Add Netlify configuration for Next.js.
- Give the owner plain steps to: connect the GitHub repo to Netlify once, add the environment variables (Supabase URL, anon key, service role key), and add the Netlify site URL to Supabase Auth settings.
- Keep build count low: fix everything locally first so the first deploy succeeds. After deploying, advise the owner how to avoid unnecessary rebuilds (e.g. batching changes into fewer pushes).

---

## 10. Out of scope

- Live sync with Kustomer, Salesforce or Moodle (store links as plain URLs).
- Password-reset and invite emails.
- A separate roles/permissions management screen.
- Any links between Quality Analyst, Curriculum and Mentor data.

## 11. Still to confirm with the client (build with defaults meanwhile)

- Super-admin flag as the Admin Dashboard gate.
- Deactivation reason stays free text (suggested examples: on leave, resigned, terminated, other).
- Complete historical sheets for Curriculum (both tabs) and Mentor.
- Extra fields for Returned cases, if any.
